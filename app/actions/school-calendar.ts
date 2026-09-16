"use server";

// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026).
//
// Server Actions per §B3 (contesto scolastico Regione/Comune, "Dove va a
// scuola?"), §B7 (override manuale "già organizzato"/"non serve") e §B11
// (minimo Admin per gestire il dataset calendari/eventi). Stesso pattern
// ownership di app/actions/kids.ts (.eq("parent_id", user.id) su ogni
// scrittura del genitore) — le scritture Admin non ripetono un controllo
// is_platform_admin() qui: la RLS di migration_26 ("School calendars/events:
// l'Admin gestisce il dataset", using (public.is_platform_admin())) è già
// la difesa autoritativa, stesso principio già seguito da
// app/actions/releases.ts (upsertScopeOverride si affida a
// feature_flag_overrides RLS, nessun controllo ruolo duplicato in TS).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isKnownItalianRegion } from "@/lib/school-calendar/regions";

// ─────────────────────────────────────────────────────────────────────────
// §B3/§B10 — contesto scolastico famiglia (Regione/Comune)
// ─────────────────────────────────────────────────────────────────────────

/**
 * "Dove va a scuola?" — §B3: UX volutamente semplice, applicata a TUTTI i
 * figli del genitore in un solo passaggio (la maggior parte delle famiglie
 * ha i figli nello stesso comune/regione scolastica; un'eventuale
 * differenziazione per singolo figlio resta possibile in futuro modificando
 * la riga kid_school_profiles del singolo bambino, la tabella è già per
 * kid_id — non una limitazione strutturale, solo dell'onboarding V1).
 * Sovrascrive SOLO i figli che non hanno ancora un profilo — un figlio già
 * configurato individualmente non viene toccato da questa azione "di
 * famiglia" (evita di disfare una correzione già fatta per un figlio
 * specifico).
 */
export async function setSchoolContextForFamilyAction(region: string, comune: string): Promise<{ error?: string; kidsUpdated?: number }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownItalianRegion(region)) return { error: "Regione non valida" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: kidRows, error: kidsError } = await supabase.from("kids").select("id").eq("parent_id", user.id);
  if (kidsError) return { error: kidsError.message };
  const kidIds = (kidRows ?? []).map((k) => k.id as string);
  if (kidIds.length === 0) return { error: "Nessun bambino trovato per questo account" };

  const { data: existingProfiles } = await supabase.from("kid_school_profiles").select("kid_id").in("kid_id", kidIds);
  const alreadyConfigured = new Set((existingProfiles ?? []).map((p) => p.kid_id as string));
  const kidIdsToInsert = kidIds.filter((id) => !alreadyConfigured.has(id));
  if (kidIdsToInsert.length === 0) return { kidsUpdated: 0 };

  const comuneTrimmed = comune.trim();
  const rows = kidIdsToInsert.map((kidId) => ({
    kid_id: kidId,
    parent_id: user.id,
    region,
    comune: comuneTrimmed.length > 0 ? comuneTrimmed : null,
  }));

  const { error } = await supabase.from("kid_school_profiles").insert(rows);
  if (error) return { error: error.message };

  return { kidsUpdated: kidIdsToInsert.length };
}

/**
 * Correzione di un singolo figlio (post-onboarding) — usata da un eventuale
 * "Correggi" per un bambino già configurato individualmente (kid_id
 * UNIQUE su kid_school_profiles: upsert semplice).
 */
export async function setSchoolContextForKidAction(kidId: string, region: string, comune: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownItalianRegion(region)) return { error: "Regione non valida" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  // Verifica ownership del bambino (stesso .eq("parent_id", ...) pattern di
  // updateKidAction) prima dell'upsert — RLS lo bloccherebbe comunque, ma un
  // controllo esplicito dà un messaggio d'errore chiaro invece di un upsert
  // silenziosamente rifiutato.
  const { data: kidRow } = await supabase.from("kids").select("id").eq("id", kidId).eq("parent_id", user.id).maybeSingle();
  if (!kidRow) return { error: "Bambino non trovato" };

  const comuneTrimmed = comune.trim();
  const { error } = await supabase
    .from("kid_school_profiles")
    .upsert({ kid_id: kidId, parent_id: user.id, region, comune: comuneTrimmed.length > 0 ? comuneTrimmed : null }, { onConflict: "kid_id" });
  if (error) return { error: error.message };
  return {};
}

// ─────────────────────────────────────────────────────────────────────────
// §B7 — override manuale "già organizzato" / "non serve"
// ─────────────────────────────────────────────────────────────────────────

/**
 * Dichiarazione esplicita del genitore per UNA settimana — vince sempre
 * sull'euristica derivata (vedi computeSchoolWeekNeed). `kidId=null` vale
 * per tutta la famiglia (migration_26: "null = vale per tutta la
 * famiglia") — usato quando il genitore risponde dalla vista aggregata
 * Planner (una sola settimana, non un bambino specifico).
 */
export async function setSchoolCalendarOverrideAction(
  weekStartDate: string,
  overrideType: "already_organized" | "not_needed",
  kidId: string | null = null
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("school_calendar_overrides")
    .upsert(
      { parent_id: user.id, kid_id: kidId, week_start_date: weekStartDate, override_type: overrideType },
      { onConflict: "parent_id,kid_id,week_start_date" }
    );
  if (error) return { error: error.message };
  return {};
}

/** Rimuove un override esistente (il genitore cambia idea, torna all'euristica derivata). */
export async function clearSchoolCalendarOverrideAction(weekStartDate: string, kidId: string | null = null): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  let query = supabase.from("school_calendar_overrides").delete().eq("parent_id", user.id).eq("week_start_date", weekStartDate);
  query = kidId === null ? query.is("kid_id", null) : query.eq("kid_id", kidId);
  const { error } = await query;
  if (error) return { error: error.message };
  return {};
}

// ─────────────────────────────────────────────────────────────────────────
// §B11 — Admin minimo: gestione dataset calendari/eventi
// ─────────────────────────────────────────────────────────────────────────
// NESSUNA di queste azioni viene MAI chiamata da Claude in questa sessione
// (governance: nessuna scrittura su dati di produzione reali) — sono
// costruite perché Fabrizio possa usarle dall'Admin quando deciderà quali
// Regione/Comune popolare per il pilota (vedi report finale, §STOP).

export async function upsertSchoolCalendarAction(input: {
  id?: string;
  region: string;
  schoolYear: string;
  validFrom: string;
  validTo: string;
  source: string;
  sourceUrl: string;
  status: "draft" | "published";
}): Promise<{ error?: string; id?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownItalianRegion(input.region)) return { error: "Regione non valida" };
  if (!input.schoolYear.trim()) return { error: "Anno scolastico obbligatorio (es. 2026/2027)" };
  if (!input.validFrom || !input.validTo) return { error: "Intervallo di validità obbligatorio" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const row = {
    country: "IT",
    region: input.region,
    school_year: input.schoolYear.trim(),
    valid_from: input.validFrom,
    valid_to: input.validTo,
    source: input.source.trim() || null,
    source_url: input.sourceUrl.trim() || null,
    source_updated_at: new Date().toISOString(),
    status: input.status,
  };

  if (input.id) {
    const { error } = await supabase.from("school_calendars").update(row).eq("id", input.id);
    if (error) return { error: error.message };
    return { id: input.id };
  }

  const { data, error } = await supabase.from("school_calendars").insert(row).select("id").single();
  if (error || !data) return { error: error?.message || "Errore nel salvataggio" };
  return { id: data.id };
}

export async function upsertSchoolCalendarEventAction(input: {
  id?: string;
  calendarId: string;
  startDate: string;
  endDate: string;
  eventType: "school_year_start" | "school_year_end" | "christmas_break" | "easter_break" | "public_holiday" | "regional_closure" | "bridge" | "other_closure";
  label: string;
  sourceLevel: "national" | "regional" | "local" | null;
  notes: string;
  // TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026): opzionale, "" o
  // undefined = evento regionale (comune NULL in DB, comportamento
  // invariato). Valorizzato = evento locale — salvato con trim ma SENZA
  // forzare il lowercase (il valore visibile in Admin/DB resta "Milano",
  // non "milano": la normalizzazione esiste SOLO come chiave di matching
  // applicativo, vedi lib/school-calendar/comune.ts).
  comune?: string;
}): Promise<{ error?: string; id?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.calendarId) return { error: "Calendario obbligatorio" };
  if (!input.startDate || !input.endDate) return { error: "Intervallo di date obbligatorio" };
  if (!input.label.trim()) return { error: "Etichetta obbligatoria" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const comuneTrimmed = (input.comune ?? "").trim();
  // §11 (limite V1 documentato, invariato): school_year_start/school_year_end
  // restano SOLO regionali — coerente con il check constraint opzionale
  // della migration (chk_boundary_events_region_only). Stessa regola
  // applicata qui lato applicativo, PRIMA di arrivare al DB: un Admin che
  // valorizza Comune per un marcatore di confine riceve un errore chiaro
  // invece di un insert rifiutato dal constraint senza spiegazione.
  if (comuneTrimmed.length > 0 && (input.eventType === "school_year_start" || input.eventType === "school_year_end")) {
    return { error: "Inizio/fine anno scolastico restano sempre eventi regionali (senza Comune)" };
  }

  const row = {
    calendar_id: input.calendarId,
    start_date: input.startDate,
    end_date: input.endDate,
    event_type: input.eventType,
    label: input.label.trim(),
    source_level: input.sourceLevel,
    notes: input.notes.trim() || null,
    comune: comuneTrimmed.length > 0 ? comuneTrimmed : null,
  };

  if (input.id) {
    const { error } = await supabase.from("school_calendar_events").update(row).eq("id", input.id);
    if (error) return { error: error.message };
    return { id: input.id };
  }

  const { data, error } = await supabase.from("school_calendar_events").insert(row).select("id").single();
  if (error || !data) return { error: error?.message || "Errore nel salvataggio" };
  return { id: data.id };
}

export async function deleteSchoolCalendarEventAction(eventId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const { error } = await supabase.from("school_calendar_events").delete().eq("id", eventId);
  if (error) return { error: error.message };
  return {};
}

/** Pubblica un calendario in stato "draft" — da quel momento visibile a qualunque utente autenticato (RLS). */
export async function publishSchoolCalendarAction(calendarId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const { error } = await supabase.from("school_calendars").update({ status: "published" }).eq("id", calendarId);
  if (error) return { error: error.message };
  return {};
}
