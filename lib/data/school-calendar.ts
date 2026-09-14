// TRAMA — SCHOOL CALENDAR INTELLIGENCE (12/09/2026) — layer I/O.
//
// Wrapper sottile su Supabase per lib/school-calendar/need-core.ts (logica
// pura, testata senza mock). Stesso principio "core puro + wrapper I/O
// sottile" già usato per Calendar Export (lib/planner/calendar-items-core.ts
// / calendar-items.ts). Nessuna query duplicata: kidIds e weeks arrivano dal
// chiamante (già letti da getKidsForUser()/getPlannerData() in
// app/nextgen/planner/page.tsx), questo file query SOLO le 4 tabelle nuove
// (school_calendars, school_calendar_events, kid_school_profiles,
// school_calendar_overrides — migration_26, già live in produzione).
//
// Degradazione sicura ovunque (§B10 "non deve mai bloccare il Planner",
// §B14 "zero sorprese per gli utenti esistenti"): qualunque errore o
// Supabase non configurato ritorna il fallback "nessun contesto scolastico"
// — MAI un'eccezione che romperebbe il resto della pagina Planner.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildClosureIntervals,
  computeSchoolWeekNeed,
  aggregateFamilySchoolWeekNeed,
  type SchoolCalendarEventInput,
  type SchoolCalendarEventType,
  type SchoolCalendarOverrideInput,
  type SchoolWeekNeed,
  type SeasonWeekNeedInput,
} from "@/lib/school-calendar/need-core";

// Sottoinsieme di SeasonWeek (lib/data/planner.ts) richiesto qui — stesso
// principio "solo i campi che servono" di need-core.ts.
export interface SchoolCalendarPlannerWeekInput {
  index: number;
  startDate: string;
  endDate: string;
  covered: boolean;
  dismissed: boolean;
}

export interface SchoolCalendarPlannerContext {
  // true se ALMENO UN bambino della famiglia ha un profilo scolastico
  // (kid_school_profiles) — usato per decidere se mostrare il badge scuola
  // nel Planner o, se false per TUTTI i figli, il callout di configurazione
  // §B10 ("Vuoi che TRAMA individui automaticamente le settimane senza
  // scuola?").
  hasAnySchoolProfile: boolean;
  // Stato aggregato famiglia per settimana — chiave = SeasonWeek.index
  // (non Map: deve restare serializzabile come prop React Server->Client).
  needByWeekIndex: Record<number, SchoolWeekNeed>;
  // kidId dei bambini SENZA profilo scolastico — per un eventuale invito
  // mirato "Configura anche [nome]" in una fase successiva; oggi usato solo
  // per decidere hasAnySchoolProfile/il callout generico.
  kidIdsWithoutProfile: string[];
}

const EMPTY_CONTEXT: SchoolCalendarPlannerContext = {
  hasAnySchoolProfile: false,
  needByWeekIndex: {},
  kidIdsWithoutProfile: [],
};

interface RawKidSchoolProfileRow {
  kid_id: string;
  region: string;
}

interface RawSchoolCalendarRow {
  id: string;
  region: string;
}

interface RawSchoolCalendarEventRow {
  calendar_id: string;
  start_date: string;
  end_date: string;
  event_type: string;
  label: string | null;
}

interface RawSchoolCalendarOverrideRow {
  kid_id: string | null;
  week_start_date: string;
  override_type: "already_organized" | "not_needed";
}

const KNOWN_EVENT_TYPES = new Set<SchoolCalendarEventType>([
  "school_year_start",
  "school_year_end",
  "christmas_break",
  "easter_break",
  "public_holiday",
  "regional_closure",
  "bridge",
  "other_closure",
]);

/**
 * Contesto scuola dell'intera famiglia per le settimane stagione passate —
 * chiamata UNA sola volta dalla pagina Planner (stesso punto che già
 * risolve CALENDAR_EXPORT_ENABLED in app/nextgen/planner/page.tsx), MAI
 * dentro un loop per bambino: tutte le query qui sotto sono già battezzate
 * per l'intera famiglia in un colpo solo.
 *
 * `kidIds` deve arrivare da getKidsForUser() (già chiamata dalla pagina
 * Planner) — nessuna query kids duplicata qui.
 */
export async function getSchoolCalendarPlannerContext(
  weeks: SchoolCalendarPlannerWeekInput[],
  kidIds: string[]
): Promise<SchoolCalendarPlannerContext> {
  if (!isSupabaseConfigured || kidIds.length === 0) {
    return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds] };

  const { data: profileRows, error: profileError } = await supabase
    .from("kid_school_profiles")
    .select("kid_id, region")
    .eq("parent_id", user.id)
    .in("kid_id", kidIds);

  if (profileError || !profileRows || profileRows.length === 0) {
    // Nessun profilo scolastico per nessun figlio — comportamento AS-IS
    // invariato (fallback identico a "Supabase non configurato"): non è un
    // errore, è lo stato reale di una famiglia che non ha ancora configurato
    // nulla.
    return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds] };
  }

  const profiles = profileRows as RawKidSchoolProfileRow[];
  const profileByKidId = new Map(profiles.map((p) => [p.kid_id, p]));
  const kidIdsWithoutProfile = kidIds.filter((id) => !profileByKidId.has(id));
  const regions = Array.from(new Set(profiles.map((p) => p.region)));

  const { data: calendarRows, error: calendarError } = await supabase
    .from("school_calendars")
    .select("id, region")
    .eq("country", "IT")
    .eq("status", "published")
    .in("region", regions);

  if (calendarError || !calendarRows || calendarRows.length === 0) {
    // Profili configurati ma nessun calendario pubblicato per quelle
    // regioni (dataset pilota non ancora popolato, o non ancora
    // pubblicato): hasAnySchoolProfile resta true (il genitore ha
    // configurato la scuola), ma need-by-week resta "school_open" per
    // tutti (nessuna chiusura nota) — MAI un falso "da organizzare" per
    // assenza di dati.
    const needByWeekIndex: Record<number, SchoolWeekNeed> = {};
    for (const w of weeks) needByWeekIndex[w.index] = "school_open";
    return { hasAnySchoolProfile: true, needByWeekIndex, kidIdsWithoutProfile };
  }

  const calendars = calendarRows as RawSchoolCalendarRow[];
  const regionByCalendarId = new Map(calendars.map((c) => [c.id, c.region]));
  const calendarIds = calendars.map((c) => c.id);

  const { data: eventRows } = await supabase
    .from("school_calendar_events")
    .select("calendar_id, start_date, end_date, event_type, label")
    .in("calendar_id", calendarIds);

  const eventsByRegion = new Map<string, SchoolCalendarEventInput[]>();
  for (const row of (eventRows ?? []) as RawSchoolCalendarEventRow[]) {
    if (!KNOWN_EVENT_TYPES.has(row.event_type as SchoolCalendarEventType)) continue; // riga inattesa: ignorata, mai un crash
    const region = regionByCalendarId.get(row.calendar_id);
    if (!region) continue;
    const list = eventsByRegion.get(region) ?? [];
    list.push({
      startDate: row.start_date,
      endDate: row.end_date,
      eventType: row.event_type as SchoolCalendarEventType,
      label: row.label ?? "",
    });
    eventsByRegion.set(region, list);
  }

  const { data: overrideRows } = await supabase
    .from("school_calendar_overrides")
    .select("kid_id, week_start_date, override_type")
    .eq("parent_id", user.id);

  // Chiave "kidId|weekStartDate" per un override specifico del bambino;
  // "null|weekStartDate" per un override di famiglia (kid_id NULL in DB —
  // vale per tutti i figli, vedi migration_26 commento "null = vale per
  // tutta la famiglia").
  const overrideByKey = new Map<string, SchoolCalendarOverrideInput>();
  for (const row of (overrideRows ?? []) as RawSchoolCalendarOverrideRow[]) {
    const key = `${row.kid_id ?? "null"}|${row.week_start_date}`;
    overrideByKey.set(key, { weekStartDate: row.week_start_date, overrideType: row.override_type });
  }

  function overrideFor(kidId: string, weekStartDate: string): SchoolCalendarOverrideInput | undefined {
    return overrideByKey.get(`${kidId}|${weekStartDate}`) ?? overrideByKey.get(`null|${weekStartDate}`);
  }

  const closuresByKidId = new Map<string, ReturnType<typeof buildClosureIntervals>>();
  for (const kidId of profileByKidId.keys()) {
    const profile = profileByKidId.get(kidId)!;
    const events = eventsByRegion.get(profile.region) ?? [];
    closuresByKidId.set(kidId, buildClosureIntervals(events));
  }

  const needByWeekIndex: Record<number, SchoolWeekNeed> = {};
  for (const week of weeks) {
    const weekInput: SeasonWeekNeedInput = { startDate: week.startDate, endDate: week.endDate, covered: week.covered, dismissed: week.dismissed };
    const perKidNeeds: SchoolWeekNeed[] = kidIds.map((kidId) => {
      const hasProfile = profileByKidId.has(kidId);
      const closures = closuresByKidId.get(kidId) ?? [];
      const override = hasProfile ? overrideFor(kidId, week.startDate) : undefined;
      return computeSchoolWeekNeed(hasProfile, weekInput, closures, override);
    });
    needByWeekIndex[week.index] = aggregateFamilySchoolWeekNeed(perKidNeeds);
  }

  return { hasAnySchoolProfile: true, needByWeekIndex, kidIdsWithoutProfile };
}
