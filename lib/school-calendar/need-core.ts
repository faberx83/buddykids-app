// TRAMA — SCHOOL CALENDAR INTELLIGENCE (12/09/2026, Parte B della richiesta
// "RELEASE CONTROL HARDENING + NEXT PRODUCT EVOLUTION").
//
// Logica pura (nessun I/O, nessuna dipendenza da Supabase/Next) per derivare
// dalle chiusure scolastiche una NUOVA informazione — "periodi da
// organizzare" — SENZA mai toccare computeWeekStatus/WeekStatus esistenti
// (lib/nextgen/planner-insights.ts) e senza mai sovrascrivere
// SeasonWeek.covered/dismissed (lib/data/planner.ts). Stesso principio già
// applicato a lib/planner/calendar-items-core.ts per Calendar Export: core
// puro testabile senza mock di Supabase, wrapper I/O separato
// (lib/data/school-calendar.ts).
//
// §B1: l'obiettivo NON è "mostrare il calendario scolastico" ma "usarlo per
// capire quali periodi vanno organizzati" — questo file produce esattamente
// quella terza informazione, distinta da:
//   - SCHOOL NEED: il bambino non ha scuola questi giorni (questo file)
//   - PLANNER COVERAGE: la famiglia ha già una soluzione? (week.covered,
//     esistente, MAI ridefinito qui)
// §B7: "settimana scuola chiusa" + "nessuna prenotazione" = DA ORGANIZZARE.
// "settimana scuola chiusa" + "già prenotata" = GIÀ COPERTA. "scuola
// chiusa" non deve mai essere confuso con "settimana non organizzata".
// §B8: la sorgente di copertura (prenotazione TRAMA oggi, domani anche un
// eventuale external_planner_item) resta un dettaglio di chi COSTRUISCE
// l'input covered/dismissed — questo file non lo sa e non gli interessa,
// riceve solo covered/dismissed già calcolati, esattamente come
// computeWeekStatus.

// ─────────────────────────────────────────────────────────────────────────
// Tipi
// ─────────────────────────────────────────────────────────────────────────

// Stessi 8 valori di school_calendar_events.event_type (migration_26, check
// constraint) — nessuna ridefinizione, solo il tipo TS corrispondente.
export type SchoolCalendarEventType =
  | "school_year_start"
  | "school_year_end"
  | "christmas_break"
  | "easter_break"
  | "public_holiday"
  | "regional_closure"
  | "bridge"
  | "other_closure";

// Un evento di calendario così come arriva da school_calendar_events — date
// ISO yyyy-mm-dd (mai Date: stesso principio di lib/season-weeks.ts, dove le
// date sono sempre stringhe ISO confrontabili lessicograficamente).
export interface SchoolCalendarEventInput {
  startDate: string;
  endDate: string;
  eventType: SchoolCalendarEventType;
  label: string;
}

// Un "intervallo di chiusura" derivato — o direttamente da UN evento (tutti
// i tipi tranne school_year_start/end, che sono MARCATORI di confine, non
// chiusure in sé), o calcolato per l'estate (vedi buildClosureIntervals).
export type SchoolClosureKind = SchoolCalendarEventType | "summer_break";

export interface SchoolClosureInterval {
  startDate: string;
  endDate: string;
  kind: SchoolClosureKind;
  label: string;
}

// Sottoinsieme di SeasonWeek (lib/data/planner.ts) — SOLO i campi che questa
// logica legge, mai l'intera interfaccia: se SeasonWeek cresce altrove,
// questo file non deve saperlo né rompersi.
export interface SeasonWeekNeedInput {
  startDate: string; // lunedì, ISO
  endDate: string; // venerdì, ISO
  covered: boolean;
  dismissed: boolean;
}

export interface SchoolCalendarOverrideInput {
  weekStartDate: string;
  overrideType: "already_organized" | "not_needed";
}

// Stato scuola per UN bambino, UNA settimana stagione.
//   no_school_context   -> il bambino non ha (ancora) un profilo scolastico
//                           configurato: nessuna intelligence, fallback
//                           silenzioso al comportamento Planner di oggi.
//   school_open         -> settimana scolastica normale (o dati di chiusura
//                           insufficienti/parziali — vedi nota V1 sotto):
//                           nessun segnale aggiuntivo.
//   closed_covered      -> scuola chiusa, ma la settimana risulta già
//                           coperta (booking reale, o override
//                           "already_organized").
//   closed_to_organize  -> scuola chiusa, nessuna soluzione nota: il segnale
//                           che §B1/§B7 vogliono davvero produrre.
//   closed_not_needed   -> scuola chiusa, ma il genitore ha già dichiarato
//                           di non aver bisogno di organizzare (dismissed
//                           esistente, o override "not_needed" dedicato).
export type SchoolWeekNeed = "no_school_context" | "school_open" | "closed_covered" | "closed_to_organize" | "closed_not_needed";

// Etichette IT per la UI Planner (§B9: "Scuola chiusa" / "Da organizzare" /
// "Già coperta" — wording esatto della richiesta). Stringa vuota per i due
// stati che NON devono generare alcun badge visibile (nessun rumore quando
// non c'è nulla da segnalare).
export const SCHOOL_WEEK_NEED_LABEL: Record<SchoolWeekNeed, string> = {
  no_school_context: "",
  school_open: "",
  closed_covered: "Scuola chiusa · già coperta",
  closed_to_organize: "Scuola chiusa · da organizzare",
  closed_not_needed: "Scuola chiusa · non ti serve",
};

// ─────────────────────────────────────────────────────────────────────────
// Utility date pure (stesso stile di lib/season-weeks.ts: stringhe ISO,
// confronto lessicografico, aritmetica via Date solo internamente).
// ─────────────────────────────────────────────────────────────────────────

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Le 5 date (lun..ven, ISO) comprese in un intervallo — usata per contare
// quanti giorni della settimana ricadono in una chiusura. Funziona per
// qualunque intervallo iso-ordinabile, non solo lun-ven, ma nel Planner è
// sempre chiamata con week.startDate/week.endDate (già lun-ven per
// costruzione — getSeasonWeekRanges).
function datesInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let cur = startDate;
  let guard = 0;
  while (cur <= endDate && guard < 14) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
    guard += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Derivazione intervalli di chiusura da eventi grezzi
// ─────────────────────────────────────────────────────────────────────────

const DIRECT_CLOSURE_TYPES = new Set<SchoolCalendarEventType>([
  "christmas_break",
  "easter_break",
  "public_holiday",
  "regional_closure",
  "bridge",
  "other_closure",
]);

/**
 * §B6 "per l'estate: identifica correttamente l'intervallo fine scuola ->
 * ripresa scuola". `events` può contenere eventi di PIÙ school_calendars
 * (tipicamente l'anno corrente + l'anno successivo per la stessa
 * regione/paese — il chiamante I/O li unisce prima di passarli qui): questa
 * funzione non assume che vengano da un unico calendario, appaia
 * semplicemente ogni school_year_end con il più vicino school_year_start
 * SUCCESSIVO fra tutti gli eventi ricevuti.
 *
 * L'ultimo giorno di scuola (school_year_end) e il primo giorno di scuola
 * del nuovo anno (school_year_start) sono giorni DI SCUOLA, non di chiusura
 * — l'intervallo derivato parte il giorno DOPO la fine e finisce il giorno
 * PRIMA della ripresa (mai includere i due giorni di confine).
 *
 * Se non è disponibile un school_year_start successivo (es. solo il
 * calendario dell'anno corrente è stato pubblicato, non ancora quello
 * dell'anno prossimo) nessuna estate viene derivata per quella fine anno —
 * comportamento silenzioso e sicuro: significa solo "dati insufficienti per
 * quel periodo", MAI un errore, e il fallback è "school_open" (nessun
 * segnale), mai un falso "closed_to_organize" inventato.
 */
function deriveSummerIntervals(events: SchoolCalendarEventInput[]): SchoolClosureInterval[] {
  const ends = events.filter((e) => e.eventType === "school_year_end").sort((a, b) => a.endDate.localeCompare(b.endDate));
  const starts = events.filter((e) => e.eventType === "school_year_start").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const intervals: SchoolClosureInterval[] = [];
  for (const end of ends) {
    const nextStart = starts.find((s) => s.startDate > end.endDate);
    if (!nextStart) continue;
    const summerStart = addDaysIso(end.endDate, 1);
    const summerEnd = addDaysIso(nextStart.startDate, -1);
    if (summerStart <= summerEnd) {
      intervals.push({ startDate: summerStart, endDate: summerEnd, kind: "summer_break", label: "Vacanze estive" });
    }
  }
  return intervals;
}

/**
 * Tutti gli intervalli di chiusura derivabili da un set di eventi grezzi:
 * le chiusure "dirette" (Natale, Pasqua, festività, ponti, chiusure
 * regionali/altro — l'intervallo è esattamente start_date..end_date
 * dell'evento) + l'estate derivata (vedi deriveSummerIntervals).
 * school_year_start/school_year_end NON producono un proprio intervallo:
 * sono solo i marcatori usati per calcolare l'estate.
 */
export function buildClosureIntervals(events: SchoolCalendarEventInput[]): SchoolClosureInterval[] {
  const direct: SchoolClosureInterval[] = events
    .filter((e) => DIRECT_CLOSURE_TYPES.has(e.eventType))
    .map((e) => ({ startDate: e.startDate, endDate: e.endDate, kind: e.eventType, label: e.label }));
  return [...direct, ...deriveSummerIntervals(events)];
}

// ─────────────────────────────────────────────────────────────────────────
// Incrocio con le settimane stagione
// ─────────────────────────────────────────────────────────────────────────

/**
 * Quanti dei 5 giorni lun-ven della settimana ricadono in almeno un
 * intervallo di chiusura. §B6: "non trasformare automaticamente ogni
 * sabato/domenica in 'da organizzare'" — non richiede logica dedicata qui,
 * perché week.startDate/endDate sono SEMPRE lun-ven per costruzione
 * (getSeasonWeekRanges, lib/season-weeks.ts): i weekend non fanno mai parte
 * di una SeasonWeek, quindi non possono mai comparire in questo conteggio.
 */
function closedWeekdayCount(week: SeasonWeekNeedInput, closures: SchoolClosureInterval[]): { closed: number; total: number } {
  const days = datesInRange(week.startDate, week.endDate);
  const closed = days.filter((d) => closures.some((c) => d >= c.startDate && d <= c.endDate)).length;
  return { closed, total: days.length };
}

/**
 * Decisione V1 deliberata (da documentare come limite noto, non un bug):
 * una settimana è considerata "scuola chiusa" ai fini del segnale
 * closed_to_organize/closed_covered SOLO se TUTTI i giorni feriali della
 * settimana ricadono in una chiusura (tipicamente: estate, Natale, Pasqua,
 * una chiusura regionale prolungata). Un singolo giorno di festività o un
 * "ponte" isolato (1-2 giorni su 5) NON fa scattare il segnale per l'intera
 * settimana: §B1/§B7 parlano esplicitamente di "periodi" di bisogno
 * familiare — un singolo giorno di sospensione dentro una settimana
 * altrimenti normale non è, da solo, un periodo che la famiglia deve
 * organizzare nello stesso senso di una settimana intera senza scuola (chi
 * ha già un'attività prenotata quella settimana la copre comunque per gli
 * altri 4 giorni). Questo NON esclude i tipi 'public_holiday'/'bridge' dal
 * modello dati (restano tracciati/interrogabili in buildClosureIntervals),
 * limita solo quando generano il segnale di settimana "da organizzare".
 */
export function isWeekSchoolClosed(week: SeasonWeekNeedInput, closures: SchoolClosureInterval[]): boolean {
  const { closed, total } = closedWeekdayCount(week, closures);
  return total > 0 && closed === total;
}

/**
 * Stato scuola per UNA settimana, UN bambino — la funzione centrale di
 * questo modulo. `hasSchoolContext=false` quando il bambino non ha ancora
 * un kid_school_profiles (nessuna riga): ritorna sempre "no_school_context",
 * senza nemmeno guardare closures/override (il chiamante I/O non dovrebbe
 * neppure calcolarli in quel caso, ma la funzione resta sicura comunque se
 * lo fa).
 *
 * Precedenza (dalla più alla meno specifica):
 *   1) nessun profilo scolastico -> no_school_context
 *   2) scuola aperta (non tutti i giorni chiusi) -> school_open
 *   3) override esplicito del genitore per QUESTA settimana -> vince sempre
 *      sul resto (è una dichiarazione esplicita, più recente/intenzionale
 *      di qualunque euristica derivata)
 *   4) dismissed esistente (week.dismissed, meccanismo generico Planner) ->
 *      closed_not_needed (coerente con "non mi serve" già dichiarato altrove,
 *      MAI un secondo stato "dismissed" diverso da quello che il genitore ha
 *      già scelto)
 *   5) week.covered (prenotazione reale) -> closed_covered
 *   6) altrimenti -> closed_to_organize
 */
export function computeSchoolWeekNeed(
  hasSchoolContext: boolean,
  week: SeasonWeekNeedInput,
  closures: SchoolClosureInterval[],
  override: SchoolCalendarOverrideInput | undefined
): SchoolWeekNeed {
  if (!hasSchoolContext) return "no_school_context";
  if (!isWeekSchoolClosed(week, closures)) return "school_open";
  if (override?.overrideType === "not_needed") return "closed_not_needed";
  if (override?.overrideType === "already_organized") return "closed_covered";
  if (week.dismissed) return "closed_not_needed";
  if (week.covered) return "closed_covered";
  return "closed_to_organize";
}

// ─────────────────────────────────────────────────────────────────────────
// Aggregazione multi-figlio (§B15 test #12: "multi-child con contesto
// scolastico diverso"). Il Planner resta a livello FAMIGLIA (§B9: non
// diventa un calendario scolastico per bambino) — questa funzione riduce gli
// stati per-bambino di UNA settimana a UN singolo stato da mostrare nella
// riga Planner di quella settimana.
// ─────────────────────────────────────────────────────────────────────────

// Ordine di priorità: il segnale più "azionabile" vince sempre. Un genitore
// con due figli, uno dei quali ha scuola chiusa e senza soluzione, deve
// vedere "da organizzare" anche se l'altro figlio è coperto o non ha ancora
// un profilo scolastico — nascondere il bisogno di un figlio perché l'altro
// sta bene sarebbe l'esatto errore che §B7 vuole evitare.
const FAMILY_NEED_PRIORITY: SchoolWeekNeed[] = ["closed_to_organize", "closed_covered", "closed_not_needed", "school_open", "no_school_context"];

export function aggregateFamilySchoolWeekNeed(perKidNeeds: SchoolWeekNeed[]): SchoolWeekNeed {
  for (const candidate of FAMILY_NEED_PRIORITY) {
    if (perKidNeeds.includes(candidate)) return candidate;
  }
  return "no_school_context";
}
