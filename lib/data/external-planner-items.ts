import "server-only";

// TRAMA — EXTERNAL PLANNER ITEMS (data layer).
//
// Legge/scrive public.external_planner_items + external_planner_item_kids
// (supabase/migration_39_external_planner_items.sql — PREPARATA, NON
// ANCORA APPLICATA: le query qui falliranno con 42P01 finché la migration
// non è applicata in produzione, stesso comportamento "atteso, non un bug"
// già documentato per curated_favorites/announcement_receipts in
// migration_38). ASSUME che la migration sia già applicata quando questo
// modulo viene invocato — tutti i call site sono nuovi in questo ciclo.
//
// COVERAGE SEMANTICS (sezione 13 del task, CRITICAL) — regola conservativa
// scelta dopo audit di lib/data/planner.ts#getPlannerData e
// lib/nextgen/planner-insights.ts#computeWeekStatus: questo modulo NON
// scrive MAI, NON legge MAI, e NON espone MAI nulla che alteri
// SeasonWeek.covered/dismissed/WeekStatus/School Calendar need. Gli
// External Planner Item sono una superficie di lettura/scrittura
// COMPLETAMENTE SEPARATA dal motore di Coverage esistente — getPlannerData()
// non è toccato da questo file, non importa nulla da qui, e non lo
// importerà finché una decisione di prodotto esplicita (non presa in questo
// rilascio) non definisce una regola precisa per "quando un impegno esterno
// conta come childcare coverage" (es. soglia oraria per kind='activity').
// external_planner_items.coverage_behavior esiste nello schema (valore
// sempre 'none' scritto da questo rilascio) proprio per rendere quella
// futura decisione un cambio di CODICE, non una nuova migration — vedi
// commento esteso nella migration stessa.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Logica pura (validazione, snapshot da Curated Lead) estratta in
// lib/planner/external-planner-items-core.ts — vedi commento di testa di
// quel file per il motivo (import "server-only" qui sopra impedisce a
// tests/one/external-planner-items.spec.ts di importare direttamente da
// questo modulo, stesso pattern già in uso per known-events.ts/need-core.ts).
export {
  validateExternalPlannerItemInput,
  buildExternalPlannerItemInputFromCuratedLead,
  type ExternalPlannerItemKind,
  type ExternalPlannerItemSourceType,
  type ExternalPlannerItemInput,
  type ValidationResult,
} from "@/lib/planner/external-planner-items-core";
import {
  validateExternalPlannerItemInput,
  type ExternalPlannerItemInput,
  type ExternalPlannerItemKind,
  type ExternalPlannerItemSourceType,
} from "@/lib/planner/external-planner-items-core";

export interface ExternalPlannerItem {
  id: string;
  kind: ExternalPlannerItemKind;
  title: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd, >= startDate
  allDay: boolean;
  startTime: string | null; // "HH:MM", ignorato se allDay
  endTime: string | null;
  location: string | null;
  notes: string | null;
  externalUrl: string | null;
  sourceType: ExternalPlannerItemSourceType;
  sourceRef: string | null; // curated_lead_id quando sourceType='curated_discovery'
  organizerSnapshot: string | null;
  kidIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Lettura
// ─────────────────────────────────────────────────────────────────────────
interface RawItemRow {
  id: string;
  kind: string;
  title: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  external_url: string | null;
  source_type: string;
  source_ref: string | null;
  organizer_snapshot: string | null;
  created_at: string;
  updated_at: string;
  external_planner_item_kids: { kid_id: string }[] | null;
}

function mapRow(row: RawItemRow): ExternalPlannerItem {
  return {
    id: row.id,
    kind: row.kind === "activity" ? "activity" : "commitment",
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    notes: row.notes,
    externalUrl: row.external_url,
    sourceType: row.source_type === "curated_discovery" ? "curated_discovery" : "manual",
    sourceRef: row.source_ref,
    organizerSnapshot: row.organizer_snapshot,
    kidIds: (row.external_planner_item_kids ?? []).map((k) => k.kid_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, kind, title, start_date, end_date, all_day, start_time, end_time, location, notes, external_url, source_type, source_ref, organizer_snapshot, created_at, updated_at, external_planner_item_kids ( kid_id )";

// Lista completa (non filtrata per periodo) per il genitore loggato — il
// Planner filtra/raggruppa lato client per settimana, stesso principio già
// in uso per getMyBookingsForParent/getPlannerData (nessun bisogno di
// paginazione: volume atteso basso per famiglia, stessa scala di kids/
// favorites).
export async function getExternalPlannerItemsForParent(): Promise<ExternalPlannerItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("external_planner_items")
    .select(SELECT_COLUMNS)
    .eq("parent_id", user.id)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error || !data) return [];
  return (data as unknown as RawItemRow[]).map(mapRow);
}

// Sezione 15 del task: "✓ Nel Planner" su una card Curated — set dei
// curated_lead_id già presenti come External Planner Item per questo
// genitore (source_type='curated_discovery'), stesso pattern di
// getCuratedFavoriteLeadIds().
export async function getCuratedLeadIdsInPlanner(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("external_planner_items")
    .select("source_ref")
    .eq("parent_id", user.id)
    .eq("source_type", "curated_discovery")
    .is("deleted_at", null);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.source_ref as string).filter((v): v is string => Boolean(v)));
}

// ─────────────────────────────────────────────────────────────────────────
// Scrittura — usate SOLO da app/actions/external-planner-items.ts
// (Server Actions, mai chiamate direttamente da un componente client).
// ─────────────────────────────────────────────────────────────────────────
export interface MutationResult {
  error?: string;
  id?: string;
}

async function requireUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createExternalPlannerItem(
  input: ExternalPlannerItemInput,
  source: { sourceType: ExternalPlannerItemSourceType; sourceRef?: string | null; organizerSnapshot?: string | null }
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const validation = validateExternalPlannerItemInput(input);
  if (!validation.valid) return { error: validation.error };

  const { supabase, user } = await requireUserClient();
  if (!user) return { error: "Non autenticato" };

  // Difesa in profondità lato applicativo (oltre alla RLS su kids/
  // external_planner_item_kids): verifica che ogni kidId appartenga
  // davvero a questo genitore PRIMA di inserire — evita un errore RLS
  // "silenzioso" a metà inserimento (item creato, associazione bambino
  // fallita) nel caso limite di un kidId non proprio.
  const { data: ownKids, error: kidsError } = await supabase.from("kids").select("id").eq("parent_id", user.id);
  if (kidsError) return { error: kidsError.message };
  const ownKidIds = new Set((ownKids ?? []).map((k) => k.id as string));
  const invalidKid = input.kidIds.find((id) => !ownKidIds.has(id));
  if (invalidKid) return { error: "Uno dei bambini selezionati non è valido." };

  const { data: inserted, error } = await supabase
    .from("external_planner_items")
    .insert({
      parent_id: user.id,
      kind: input.kind,
      title: input.title.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      all_day: input.allDay,
      start_time: input.allDay ? null : input.startTime,
      end_time: input.allDay ? null : input.endTime,
      location: input.location || null,
      notes: input.notes || null,
      external_url: input.externalUrl || null,
      source_type: source.sourceType,
      source_ref: source.sourceRef ?? null,
      organizer_snapshot: source.organizerSnapshot ?? null,
      // coverage_behavior: colonna lasciata al default SQL ('none') di
      // proposito — nessuna scrittura esplicita da questo data layer, vedi
      // commento di testa del file.
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message ?? "Errore durante la creazione." };

  const itemId = inserted.id as string;
  const { error: kidLinkError } = await supabase
    .from("external_planner_item_kids")
    .insert(input.kidIds.map((kidId) => ({ item_id: itemId, kid_id: kidId })));
  if (kidLinkError) {
    // Rollback applicativo: nessuna FK "orfana" visibile al genitore (un
    // item senza nessun bambino associato sarebbe comunque valido a
    // livello schema, ma il data layer richiede sempre >=1 — vedi
    // validateExternalPlannerItemInput).
    await supabase.from("external_planner_items").delete().eq("id", itemId);
    return { error: kidLinkError.message };
  }

  return { id: itemId };
}

export async function updateExternalPlannerItem(itemId: string, input: ExternalPlannerItemInput): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const validation = validateExternalPlannerItemInput(input);
  if (!validation.valid) return { error: validation.error };

  const { supabase, user } = await requireUserClient();
  if (!user) return { error: "Non autenticato" };

  const { data: ownKids, error: kidsError } = await supabase.from("kids").select("id").eq("parent_id", user.id);
  if (kidsError) return { error: kidsError.message };
  const ownKidIds = new Set((ownKids ?? []).map((k) => k.id as string));
  const invalidKid = input.kidIds.find((id) => !ownKidIds.has(id));
  if (invalidKid) return { error: "Uno dei bambini selezionati non è valido." };

  // RLS (parent_id = auth.uid()) garantisce comunque che questo UPDATE non
  // tocchi mai un item di un altro genitore — il .eq("parent_id", ...) qui
  // è difesa in profondità esplicita, non l'unico gate di sicurezza.
  const { error } = await supabase
    .from("external_planner_items")
    .update({
      kind: input.kind,
      title: input.title.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      all_day: input.allDay,
      start_time: input.allDay ? null : input.startTime,
      end_time: input.allDay ? null : input.endTime,
      location: input.location || null,
      notes: input.notes || null,
      external_url: input.externalUrl || null,
    })
    .eq("id", itemId)
    .eq("parent_id", user.id);
  if (error) return { error: error.message };

  // Ricostruzione completa delle associazioni bambino (delete + insert) —
  // volume atteso per item (1-4 bambini) rende questo pattern più semplice
  // e sicuro di un diff riga per riga, stesso principio già accettabile
  // altrove nel repo per relazioni N:N di basso volume.
  const { error: deleteLinksError } = await supabase.from("external_planner_item_kids").delete().eq("item_id", itemId);
  if (deleteLinksError) return { error: deleteLinksError.message };
  const { error: insertLinksError } = await supabase
    .from("external_planner_item_kids")
    .insert(input.kidIds.map((kidId) => ({ item_id: itemId, kid_id: kidId })));
  if (insertLinksError) return { error: insertLinksError.message };

  return { id: itemId };
}

// Sezione 10 del task: "Delete... nessun impatto su Discovery/Favorite/
// source, nessun impatto su Partner" — soft-delete (deleted_at), mai un
// DELETE fisico, per preservare l'identità stabile richiesta dalle sezioni
// 19-23 (futuro sync calendario). Le liste di lettura filtrano sempre
// "deleted_at is null" (vedi getExternalPlannerItemsForParent sopra).
export async function softDeleteExternalPlannerItem(itemId: string): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUserClient();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("external_planner_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("parent_id", user.id);
  if (error) return { error: error.message };
  return { id: itemId };
}
