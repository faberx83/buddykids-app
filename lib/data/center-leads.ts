// TRAMA ONE Build Sprint 5 — CenterLead: un genitore segnala un centro non
// ancora iscritto a TRAMA. Vedi supabase/migration_17_center_leads.sql per
// lo schema/RLS e docs/trama-one/analysis/SPRINT_5_FEATURE_PRESERVATION_
// MATRIX.md per la riconciliazione con l'AS-IS (in particolare: NON è la
// stessa cosa di public.invites, che è il codice promo Partner→Genitore).
//
// Scope Sprint 5 (deliberatamente ridotto, SPRINT_GOVERNANCE.md): nessuna
// automazione economica reale. reward_status/reward_note sono annotazioni
// manuali dell'Admin, mai calcolate o erogate da questo codice.

import { CenterLeadDemandContext, CenterLeadItem, CenterLeadRewardStatus, CenterLeadStatus, CenterLeadType } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Normalizzazione per la dedupe (Must, §B.2.2 della fonte di design):
// lower-case, trim, rimozione accenti/punteggiatura/spazi multipli. Fatta
// lato applicativo (non con l'estensione Postgres "unaccent", non installata
// in questo progetto — coerente con la scelta generale di questo repository
// di tenere la logica di dominio in TypeScript puro, non in funzioni SQL).
export function normalizeDedupeKey(name: string, locality?: string | null): string {
  const strip = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // rimuove i diacritici (é->e, à->a, ecc.)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const namePart = strip(name);
  const localityPart = locality ? strip(locality) : "";
  return localityPart ? `${namePart}|${localityPart}` : namePart;
}

interface RawRow {
  id: string;
  suggested_name: string;
  suggested_locality: string | null;
  suggested_contact: string | null;
  demand_context: CenterLeadDemandContext | null;
  dedupe_key: string;
  status: CenterLeadStatus;
  duplicate_of: string | null;
  admin_note: string | null;
  claimed_center_id: string | null;
  claimed_at: string | null;
  reward_status: CenterLeadRewardStatus;
  reward_note: string | null;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  centers: { name: string } | { name: string }[] | null;
  // Migrazione 21 — assenti su PARENT_SELECT_COLUMNS (non serve distinguerle
  // lì: le righe di un genitore sono sempre 'parent_referral'), per questo
  // mapRow sotto usa un fallback quando lead_type è undefined a runtime.
  lead_type?: CenterLeadType;
  candidate_email?: string | null;
  candidate_phone?: string | null;
}

// Colonne complete (include admin_note) — SOLO per la vista Admin. La vista
// Genitore usa PARENT_SELECT_COLUMNS sotto, che non include admin_note: la
// RLS è a livello di riga (il genitore può leggere solo le proprie righe),
// non di colonna, quindi la riservatezza di admin_note verso il genitore è
// garantita qui, nel data layer, non dal database (AC-049-05).
// "profiles!suggested_by" (non il generico "profiles") è OBBLIGATORIO qui:
// center_leads ha DUE foreign key verso profiles (suggested_by e
// reward_marked_by, vedi migration_17_center_leads.sql) — con l'hint
// generico PostgREST non sa quale usare e la query fallisce con "more than
// one relationship was found", un errore che getAllCenterLeadsForAdmin()
// intercetta e traduce silenziosamente in lista vuota (stesso fail-safe
// "mai un errore visibile all'utente" adottato in tutto questo repository).
// Root cause di TC-N603 (coda Admin sempre vuota nonostante righe reali nel
// DB): stesso pattern di disambiguazione già in uso in
// lib/data/center-bookings.ts e lib/data/inquiries.ts ("profiles!parent_id").
const ADMIN_SELECT_COLUMNS =
  "id, suggested_name, suggested_locality, suggested_contact, demand_context, dedupe_key, status, duplicate_of, admin_note, claimed_center_id, claimed_at, reward_status, reward_note, created_at, profiles!suggested_by ( full_name ), centers ( name ), lead_type, candidate_email, candidate_phone";

const PARENT_SELECT_COLUMNS =
  "id, suggested_name, suggested_locality, demand_context, dedupe_key, status, claimed_center_id, claimed_at, reward_status, reward_note, created_at, centers ( name )";

function mapRow(row: RawRow, includeAdminNote: boolean): CenterLeadItem {
  return {
    id: row.id,
    suggestedName: row.suggested_name,
    suggestedLocality: row.suggested_locality ?? undefined,
    suggestedContact: row.suggested_contact ?? undefined,
    demandContext: row.demand_context ?? {},
    dedupeKey: row.dedupe_key,
    status: row.status,
    duplicateOf: row.duplicate_of ?? undefined,
    suggestedByName: firstOf(row.profiles)?.full_name ?? undefined,
    adminNote: includeAdminNote ? (row.admin_note ?? undefined) : undefined,
    claimedCenterId: row.claimed_center_id ?? undefined,
    claimedCenterName: firstOf(row.centers)?.name ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    rewardStatus: row.reward_status,
    rewardNote: row.reward_note ?? undefined,
    createdAt: row.created_at,
    leadType: row.lead_type ?? "parent_referral",
    candidateEmail: row.candidate_email ?? undefined,
    candidatePhone: row.candidate_phone ?? undefined,
  };
}

// Le PROPRIE segnalazioni del genitore loggato — usata da "I tuoi
// suggerimenti" (Genitore). Non include admin_note (vedi sopra).
export async function getMyCenterLeads(): Promise<CenterLeadItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("center_leads")
    .select(PARENT_SELECT_COLUMNS)
    .eq("suggested_by", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as RawRow[]).map((r) => mapRow(r, false));
}

// Tutte le segnalazioni, qualunque stato — usata dalla coda Admin
// (/admin/center-leads). Le RLS lasciano passare tutte le righe solo se
// l'utente è davvero platform_admin.
export async function getAllCenterLeadsForAdmin(): Promise<CenterLeadItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("center_leads")
    .select(ADMIN_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as RawRow[]).map((r) => mapRow(r, true));
}

// Elenco leggero id+nome di tutti i centri — usato SOLO dal picker "Claim"
// della coda Admin per collegare un lead al centro reale che ha completato
// l'onboarding (public.centers è a lettura pubblica, nessun dato sensibile).
export async function getCentersForClaimPicker(): Promise<{ id: string; name: string }[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("centers").select("id, name").order("name", { ascending: true });
  if (error || !data) return [];
  return data;
}

// Possibili duplicati per un dedupe_key dato — usata dall'Admin durante il
// triage per decidere se marcare una nuova segnalazione come duplicate_of di
// una già esistente. Sola lettura, nessuna scrittura automatica.
export async function findPossibleDuplicates(dedupeKey: string, excludeId?: string): Promise<CenterLeadItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let query = supabase.from("center_leads").select(ADMIN_SELECT_COLUMNS).eq("dedupe_key", dedupeKey);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as unknown as RawRow[]).map((r) => mapRow(r, true));
}

// Migrazione 21 — "Candidati come centro". Stato pubblico (3 soli campi, mai
// admin_note/candidate_phone/altre righe) di UNA autocandidatura, letto
// SENZA login dalla pagina di conferma raggiunta dal candidato subito dopo
// l'invio del form (link con l'id opaco della riga, mai un token dedicato:
// un UUID v4 non è indovinabile). Usa il service client (bypassa le RLS)
// perché il candidato non ha alcuna sessione autenticata: la RLS di
// center_leads richiede suggested_by = auth.uid() o is_platform_admin(),
// nessuno dei due è vero per un visitatore anonimo — coerente con lo stesso
// service client già usato per submitCenterCandidacyAction
// (app/actions/center-leads.ts).
export interface PublicCandidacyStatus {
  suggestedName: string;
  status: CenterLeadStatus;
  candidateEmail?: string;
  createdAt: string;
}

export async function getCandidacyStatusPublic(id: string): Promise<PublicCandidacyStatus | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("center_leads")
    .select("suggested_name, status, candidate_email, created_at, lead_type")
    .eq("id", id)
    .eq("lead_type", "self_candidacy")
    .maybeSingle();

  if (error || !data) return null;
  return {
    suggestedName: data.suggested_name,
    status: data.status,
    candidateEmail: data.candidate_email ?? undefined,
    createdAt: data.created_at,
  };
}
