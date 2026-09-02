// SPRINT 5.3 (NEXTGEN) — "Condivisione Piano": link pubblico di sola lettura
// per un periodo (settimana o mese), per chi non ha un account (nonni, tata,
// altri genitori) — vedi supabase/schema.sql per la tabella plan_shares e le
// funzioni pubbliche get_shared_plan()/get_shared_plan_meta() (security
// definer, restituiscono SOLO campi non sensibili: mai importi/indirizzi/
// contatti). Stesso pattern già usato per get_invite_preview() (inviti).

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { seasonYearFromDates } from "@/lib/season-weeks";
import {
  buildSharedPlanEntriesFromRows,
  type RawEntryBookingRow,
  type SharedPlanEntry,
} from "@/lib/plan-shares/build-entries";

export interface PlanShare {
  id: string;
  token: string;
  label: string | null;
  scopeStart: string;
  scopeEnd: string;
  createdAt: string;
  revokedAt: string | null;
  // Fix privacy 06/08/2026 (migration_24): ogni link scade 30gg dopo la
  // creazione — mostrato al genitore nell'elenco "I tuoi link condivisi"
  // cosi sa quando smettera' di funzionare.
  expiresAt: string;
}

interface RawPlanShareRow {
  id: string;
  token: string;
  label: string | null;
  scope_start: string;
  scope_end: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string;
}

// Elenco dei link creati dal genitore loggato (per gestirli/revocarli) — MAI
// usato dalla pagina pubblica, che passa sempre dalle funzioni RPC qui sotto.
export async function getPlanSharesForParent(): Promise<PlanShare[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("plan_shares")
    .select("id, token, label, scope_start, scope_end, created_at, revoked_at, expires_at")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as RawPlanShareRow[]).map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    scopeStart: r.scope_start,
    scopeEnd: r.scope_end,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
    expiresAt: r.expires_at,
  }));
}

export interface SharedPlanMeta {
  label: string | null;
  scopeStart: string;
  scopeEnd: string;
  valid: boolean;
}

// Usata dalla pagina pubblica (nessun login) — passa dalla funzione RPC
// get_shared_plan_meta (security definer), non legge mai plan_shares
// direttamente: la tabella resta privata al genitore proprietario.
export async function getSharedPlanMeta(token: string): Promise<SharedPlanMeta | null> {
  if (!isSupabaseConfigured || !token) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_plan_meta", { p_token: token }).maybeSingle();
  if (error || !data) return null;

  const row = data as { label: string | null; scope_start: string; scope_end: string; valid: boolean };
  return {
    label: row.label,
    scopeStart: row.scope_start,
    scopeEnd: row.scope_end,
    valid: Boolean(row.valid),
  };
}

// SharedPlanEntry (forma dell'entry pubblica) e la logica pura di
// trasformazione vivono ora in lib/plan-shares/build-entries.ts (importati
// sopra) — vedi quel file per il commento completo di ROOT CAUSE ANALYSIS
// (punto 1) e per il motivo dell'estrazione (testabilità, stesso principio
// già usato per lib/booking-response/apply-day-decision.ts). Qui restano
// solo l'orchestrazione (risoluzione token → query → trasformazione) e il
// fallback via RPC.
export type { SharedPlanEntry };

interface RawSharedPlanRow {
  kid_name: string;
  activity_name: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
}

interface RawShareRow {
  parent_id: string;
  scope_start: string;
  scope_end: string;
  revoked_at: string | null;
}

// Contenuto pubblico: SOLO nome bambino, attività, date, stato — mai importi/
// indirizzi/contatti/parent_id/kid_id/booking_id/email/telefono (punto 3).
async function getSharedPlanEntriesViaServiceRole(token: string): Promise<SharedPlanEntry[] | null> {
  const supabase = createServiceClient();
  if (!supabase) return null; // SUPABASE_SERVICE_ROLE_KEY non configurata: nessun fallback silenzioso rotto, vedi chiamante

  const { data: shareRow, error: shareError } = await supabase
    .from("plan_shares")
    .select("parent_id, scope_start, scope_end, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (shareError || !shareRow) return [];
  const share = shareRow as RawShareRow;
  if (share.revoked_at) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "partner_decision, activities ( name ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( partner_decision, activity_days ( date ) ), booking_kids ( kid_id, kids ( name ) )"
    )
    .eq("parent_id", share.parent_id)
    .neq("status", "cancelled");
  if (error || !data) return [];

  const seasonYear = seasonYearFromDates([share.scope_start, share.scope_end], new Date().getUTCFullYear());
  return buildSharedPlanEntriesFromRows(data as RawEntryBookingRow[], share.scope_start, share.scope_end, seasonYear);
}

// Fallback: se SUPABASE_SERVICE_ROLE_KEY non è configurata su questo
// deployment, torna al vecchio comportamento via RPC (get_shared_plan, anon-
// safe) — copre SOLO booking_weeks (stesso limite di prima), MAI un
// peggioramento rispetto a oggi. Il fix completo (punto 1-2) si attiva da
// solo appena la env var è impostata, senza bisogno di alcuna nuova
// migration o deploy dedicato.
async function getSharedPlanEntriesViaRpcFallback(token: string): Promise<SharedPlanEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_plan", { p_token: token });
  if (error || !data) return [];
  return (data as RawSharedPlanRow[]).map((r) => ({
    kidName: r.kid_name,
    activityName: r.activity_name,
    weekStartDate: r.week_start_date,
    weekEndDate: r.week_end_date,
    status: r.status,
  }));
}

export async function getSharedPlanEntries(token: string): Promise<SharedPlanEntry[]> {
  if (!isSupabaseConfigured || !token) return [];

  const viaServiceRole = await getSharedPlanEntriesViaServiceRole(token);
  if (viaServiceRole !== null) return viaServiceRole;

  return getSharedPlanEntriesViaRpcFallback(token);
}
