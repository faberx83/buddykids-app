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
//
// TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026): school_calendar_events
// ha ora anche una colonna "comune" (nullable — vedi
// PART_D2_migration_comune_scope.sql). NULL = evento REGIONALE (baseline,
// comportamento invariato), valorizzato = evento LOCALE (si applica solo ai
// bambini con lo stesso comune in kid_school_profiles, match normalizzato
// via normalizeComuneKey — vedi lib/school-calendar/comune.ts). Composizione
// per bambino: eventi regionali + eventi locali del proprio comune, unione
// semplice (buildClosureIntervals già gestisce l'unione degli intervalli,
// nessun dedup aggiuntivo qui). ATTENZIONE DEPLOY: questo file legge la
// colonna "comune" — NON deployare prima che la migration sia applicata in
// produzione (altrimenti la SELECT fallisce, "colonna non trovata"). Ordine
// esatto nel report di sessione: migration -> post-check -> deploy codice.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildClosureIntervals,
  computeSchoolWeekNeed,
  aggregateFamilySchoolWeekNeed,
  computeWeekClosureDetail,
  describePartialClosure,
  type SchoolCalendarEventType,
  type SchoolCalendarOverrideInput,
  type SchoolWeekNeed,
  type SeasonWeekNeedInput,
} from "@/lib/school-calendar/need-core";
import { deriveCurrentAcademicYear } from "@/lib/school-calendar/academic-year";
import { groupEventsByScope, composeKidCalendarEvents, type RegionComuneEvent } from "@/lib/school-calendar/comune";

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
  // TRAMA — SCHOOL CALENDAR UX REFINEMENT (§6 "PARTIAL SCHOOL CLOSURES",
  // 14/09/2026): testo informativo ("Scuola chiusa mer 2" / "3 giorni senza
  // scuola") per una settimana che needByWeekIndex[index] già classifica
  // "school_open" (1-4 giorni su 5 chiusi non bastano a far scattare il
  // segnale principale, vedi need-core.ts#isWeekSchoolClosed) — MAI presente
  // insieme a un need diverso da "school_open"/"no_school_context" (il
  // segnale principale copre già quel caso, nessuna duplicazione).
  partialClosureNoteByWeekIndex: Record<number, string>;
  // Numero di figli SENZA profilo scolastico — usato dal callout Planner
  // (§13 multi-child: "1+ configurati ma non tutti" -> "Completa il
  // calendario scolastico" con il conteggio, "0 configurati" -> copy
  // generica). Semplice derivato di kidIdsWithoutProfile.length, esposto qui
  // per evitare che ogni chiamante debba ricalcolarlo.
  kidsWithoutProfileCount: number;
  kidsTotalCount: number;
}

const EMPTY_CONTEXT: SchoolCalendarPlannerContext = {
  hasAnySchoolProfile: false,
  needByWeekIndex: {},
  kidIdsWithoutProfile: [],
  partialClosureNoteByWeekIndex: {},
  kidsWithoutProfileCount: 0,
  kidsTotalCount: 0,
};

interface RawKidSchoolProfileRow {
  kid_id: string;
  region: string;
  // TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026): letto ORA (prima
  // era selezionato solo da getKidSchoolProfilesForParent, mai qui) per
  // risolvere gli eventi locali (school_calendar_events.comune valorizzato)
  // oltre alla baseline regionale — vedi eventsByRegion/localEventsByRegionComune
  // più sotto. Resta nullable: un bambino senza comune impostato riceve
  // SOLO la baseline regionale, comportamento invariato rispetto a prima.
  comune: string | null;
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
  // TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026): NULL = evento
  // regionale (comportamento invariato), valorizzato = evento locale — vedi
  // PART_D2_migration_comune_scope.sql. ATTENZIONE DEPLOY: questa colonna
  // deve esistere in produzione PRIMA che questo codice sia deployato —
  // vedi ordine STEP nel report di sessione, MAI invertire l'ordine.
  comune: string | null;
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
    return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds], kidsWithoutProfileCount: kidIds.length, kidsTotalCount: kidIds.length };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds], kidsWithoutProfileCount: kidIds.length, kidsTotalCount: kidIds.length };

  const { data: profileRows, error: profileError } = await supabase
    .from("kid_school_profiles")
    .select("kid_id, region, comune")
    .eq("parent_id", user.id)
    .in("kid_id", kidIds);

  if (profileError || !profileRows || profileRows.length === 0) {
    // Nessun profilo scolastico per nessun figlio — comportamento AS-IS
    // invariato (fallback identico a "Supabase non configurato"): non è un
    // errore, è lo stato reale di una famiglia che non ha ancora configurato
    // nulla.
    return { ...EMPTY_CONTEXT, kidIdsWithoutProfile: [...kidIds], kidsWithoutProfileCount: kidIds.length, kidsTotalCount: kidIds.length };
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
    return {
      hasAnySchoolProfile: true,
      needByWeekIndex,
      kidIdsWithoutProfile,
      partialClosureNoteByWeekIndex: {},
      kidsWithoutProfileCount: kidIdsWithoutProfile.length,
      kidsTotalCount: kidIds.length,
    };
  }

  const calendars = calendarRows as RawSchoolCalendarRow[];
  const regionByCalendarId = new Map(calendars.map((c) => [c.id, c.region]));
  const calendarIds = calendars.map((c) => c.id);

  // TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026): SELECT unica
  // invariata nel numero di round-trip (nessun N+1 introdotto) — "comune"
  // viaggia nella stessa riga già letta oggi, non serve una seconda
  // tabella/join. Vedi PART_D2_migration_comune_scope.sql per la colonna
  // (NON ancora applicata in produzione al momento di questo commit — MAI
  // deployare questo file prima che la migration sia live, altrimenti
  // questa select fallisce con "colonna non trovata").
  const { data: eventRows } = await supabase
    .from("school_calendar_events")
    .select("calendar_id, start_date, end_date, event_type, label, comune")
    .in("calendar_id", calendarIds);

  // Trasforma le righe grezze in RegionComuneEvent (region già risolta da
  // school_calendars, comune così come letto dalla riga — MAI normalizzato
  // qui) e delega il raggruppamento region/comune a groupEventsByScope
  // (lib/school-calendar/comune.ts, logica pura e testata senza mock).
  const regionComuneEvents: RegionComuneEvent[] = [];
  for (const row of (eventRows ?? []) as RawSchoolCalendarEventRow[]) {
    if (!KNOWN_EVENT_TYPES.has(row.event_type as SchoolCalendarEventType)) continue; // riga inattesa: ignorata, mai un crash
    const region = regionByCalendarId.get(row.calendar_id);
    if (!region) continue;
    regionComuneEvents.push({
      region,
      comune: row.comune,
      event: {
        startDate: row.start_date,
        endDate: row.end_date,
        eventType: row.event_type as SchoolCalendarEventType,
        label: row.label ?? "",
      },
    });
  }
  const groupedEvents = groupEventsByScope(regionComuneEvents);

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
    // composeKidCalendarEvents (lib/school-calendar/comune.ts) risolve
    // baseline regionale + eventi locali del comune del bambino (se
    // impostato) — profile.comune === null -> SOLO baseline regionale,
    // comportamento sicuro e prevedibile. Unione semplice: nessun dedup
    // necessario qui, buildClosureIntervals + closedWeekdayCount
    // (need-core.ts) trattano già l'insieme come OR di intervalli, non una
    // somma — un evento regionale e uno locale sullo stesso giorno non
    // raddoppiano mai closedWeekdaysCount.
    const events = composeKidCalendarEvents(groupedEvents, { region: profile.region, comune: profile.comune });
    closuresByKidId.set(kidId, buildClosureIntervals(events));
  }

  const needByWeekIndex: Record<number, SchoolWeekNeed> = {};
  // TRAMA — SCHOOL CALENDAR UX REFINEMENT (§6, 14/09/2026): stesso loop,
  // stesse closures già costruite sopra per il segnale principale — nessuna
  // query aggiuntiva, nessun N+1. Per ogni settimana che finisce
  // "school_open" (nessun figlio ha tutti e 5 i giorni chiusi), calcola
  // anche il dettaglio 1-4 giorni per i figli CON profilo e tiene il
  // "peggiore" (più giorni chiusi) come nota informativa — mai per una
  // settimana già "closed_*" (il segnale principale basta, vedi
  // describePartialClosure).
  const partialClosureNoteByWeekIndex: Record<number, string> = {};
  for (const week of weeks) {
    const weekInput: SeasonWeekNeedInput = { startDate: week.startDate, endDate: week.endDate, covered: week.covered, dismissed: week.dismissed };
    const perKidNeeds: SchoolWeekNeed[] = kidIds.map((kidId) => {
      const hasProfile = profileByKidId.has(kidId);
      const closures = closuresByKidId.get(kidId) ?? [];
      const override = hasProfile ? overrideFor(kidId, week.startDate) : undefined;
      return computeSchoolWeekNeed(hasProfile, weekInput, closures, override);
    });
    const aggregatedNeed = aggregateFamilySchoolWeekNeed(perKidNeeds);
    needByWeekIndex[week.index] = aggregatedNeed;

    if (aggregatedNeed === "school_open") {
      let worstDetail: ReturnType<typeof computeWeekClosureDetail> | null = null;
      for (const kidId of profileByKidId.keys()) {
        const closures = closuresByKidId.get(kidId) ?? [];
        const detail = computeWeekClosureDetail(weekInput, closures);
        if (!worstDetail || detail.closedWeekdaysCount > worstDetail.closedWeekdaysCount) worstDetail = detail;
      }
      const note = worstDetail ? describePartialClosure(worstDetail) : null;
      if (note) partialClosureNoteByWeekIndex[week.index] = note;
    }
  }

  return {
    hasAnySchoolProfile: true,
    needByWeekIndex,
    kidIdsWithoutProfile,
    partialClosureNoteByWeekIndex,
    kidsWithoutProfileCount: kidIdsWithoutProfile.length,
    kidsTotalCount: kidIds.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// TRAMA — SCHOOL CALENDAR UX REFINEMENT (§9-11 "CHILD PROFILE — SCHOOL
// CONTEXT" / "CREATE CHILD" / "EDIT CHILD PROFILE", 14/09/2026).
//
// Source of truth resta SEMPRE kid_school_profiles (§9: "NON duplicare
// region/comune dentro kids", nessuna migration) — questa funzione legge lo
// stato scolastico per il profilo/modifica bambino, uno per kid_id, più la
// disponibilità REALE di un calendario pubblicato per l'anno scolastico
// corrente (§11: "NON inventare availability... deve provenire dai dati
// reali di school_calendars", §15: anno derivato da deriveCurrentAcademicYear,
// mai chiesto al genitore).
// ─────────────────────────────────────────────────────────────────────────

export interface KidSchoolProfileSummary {
  region: string;
  comune: string | null;
  // true SOLO se esiste un school_calendars pubblicato per questa regione E
  // per l'anno scolastico corrente derivato (deriveCurrentAcademicYear) —
  // mai un default ottimistico.
  calendarAvailable: boolean;
  // "2026/27" — solo metadata (§15), mai un valore che il genitore compila.
  academicYearShort: string;
}

interface RawKidSchoolProfileFullRow {
  kid_id: string;
  region: string;
  comune: string | null;
}

/**
 * Stato scolastico per il Profilo/Modifica bambino — un `KidSchoolProfileSummary`
 * per ogni kid_id CHE ha un profilo (§14: "se region non è impostata, nessuna
 * configurazione scolastica attiva" — un kid_id assente dalla mappa
 * risultante significa semplicemente "non ancora configurato", non un
 * errore). Chiamata dalle pagine Profilo (LEGACY e NEXTGEN, stesso
 * componente condiviso ProfileKidsSection/AddKidForm) — SOLO quando
 * SCHOOL_CALENDAR_INTELLIGENCE_ENABLED risolve true per l'utente (verificato
 * dal chiamante, stesso principio difensivo del resto di questo file).
 */
export async function getKidSchoolProfilesForParent(kidIds: string[]): Promise<Record<string, KidSchoolProfileSummary>> {
  if (!isSupabaseConfigured || kidIds.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profileRows, error } = await supabase
    .from("kid_school_profiles")
    .select("kid_id, region, comune")
    .eq("parent_id", user.id)
    .in("kid_id", kidIds);

  if (error || !profileRows || profileRows.length === 0) return {};

  const profiles = profileRows as RawKidSchoolProfileFullRow[];
  const regions = Array.from(new Set(profiles.map((p) => p.region)));
  const { stored: academicYearStored, short: academicYearShort } = deriveCurrentAcademicYear(new Date().toISOString().slice(0, 10));

  // Un'unica query per TUTTE le regioni coinvolte (mai un round-trip per
  // figlio, stesso principio "nessun N+1" già seguito sopra) — match esatto
  // su school_year: i calendari Admin sono inseriti nello stesso formato
  // lungo ("2026/2027", vedi placeholder SchoolCalendarAdminClient.tsx), che
  // è esattamente il formato "stored" derivato qui.
  const { data: calendarRows } = await supabase
    .from("school_calendars")
    .select("region")
    .eq("country", "IT")
    .eq("status", "published")
    .eq("school_year", academicYearStored)
    .in("region", regions);

  const availableRegions = new Set(((calendarRows ?? []) as { region: string }[]).map((r) => r.region));

  const result: Record<string, KidSchoolProfileSummary> = {};
  for (const p of profiles) {
    result[p.kid_id] = {
      region: p.region,
      comune: p.comune,
      calendarAvailable: availableRegions.has(p.region),
      academicYearShort,
    };
  }
  return result;
}
