// TRAMA — WEEK PLANNER UX REDESIGN (29/09/2026, brief verbatim di Fabrizio
// dopo aver visto live la vista Settimana). Logica PURA (nessuna dipendenza
// React/server), stessa convenzione "[no browser]" già usata in
// lib/nextgen/agenda-view.ts/bulk-assign.ts/calendar-weeks.ts: questo modulo
// NON ricalcola covered/dismissed/coveredKids/overlap — legge solo dati già
// calcolati a monte (CalendarDay da lib/nextgen/calendar-weeks.ts,
// AgendaRow[] da lib/nextgen/agenda-view.ts, KidOverlap da
// lib/nextgen/planner-insights.ts) e li riduce a stringhe/numeri pronti per
// il rendering — "presentation layer, non business logic", stesso principio
// di agenda-view.ts.
//
// Punto 2 del brief ("Week should feel like Agenda expanded to seven days")
// — la vista Settimana riusa DIRETTAMENTE mondayOfIso/addDaysIso/
// agendaWeekDates/formatMonthYearIt/buildAgendaRows già estratti per Agenda
// (lib/nextgen/agenda-view.ts), questo modulo aggiunge SOLO ciò che è
// specifico della vista a 7 giorni (range di date dell'intestazione,
// riepilogo settimana, dettaglio conflitto per bambino) — zero duplicazione
// della logica già esistente.

import { addDaysIso } from "@/lib/nextgen/agenda-view";
import type { AgendaRow } from "@/lib/nextgen/agenda-view";
import { KidOverlap, weekIndexFromLabel, overlapVerb, formatBookingNames } from "@/lib/nextgen/planner-insights";
import type { KidGender } from "@/lib/types";

const MONTH_SHORT_IT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];
const MONTH_FULL_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Sezione 3 del brief — intestazione "6–12 APRILE 2026": range di date della
// settimana (Lun..Dom) che inizia a `mondayIso`. Gestisce mese/anno diversi
// tra inizio e fine settimana (settimana a cavallo di due mesi o due anni,
// sezione 20 "cross-month week; cross-year week if relevant") senza mai
// inventare un formato ambiguo — sempre "giorno mese[ anno]" per entrambi gli
// estremi quando mese o anno differiscono, altrimenti il mese/anno è
// mostrato una sola volta (caso comune, settimana dentro lo stesso mese).
// Reso in minuscolo qui (stesso stile di formatMonthYearIt in
// agenda-view.ts) — la resa MAIUSCOLA del mockup di Fabrizio è un trattamento
// visivo (classe CSS `uppercase`), non una responsabilità di questa
// funzione pura.
export function formatWeekDateRangeIt(mondayIso: string): string {
  const sundayIso = addDaysIso(mondayIso, 6);
  const [y1, m1, d1] = mondayIso.split("-").map(Number);
  const [y2, m2, d2] = sundayIso.split("-").map(Number);
  const day1 = d1;
  const day2 = d2;
  if (y1 === y2 && m1 === m2) {
    return `${day1}–${day2} ${MONTH_FULL_IT[m1 - 1]} ${y1}`;
  }
  if (y1 === y2) {
    return `${day1} ${MONTH_SHORT_IT[m1 - 1]} – ${day2} ${MONTH_SHORT_IT[m2 - 1]} ${y1}`;
  }
  return `${day1} ${MONTH_SHORT_IT[m1 - 1]} ${y1} – ${day2} ${MONTH_SHORT_IT[m2 - 1]} ${y2}`;
}

// Sezione 11 del brief — "il warning deve apparire SOLO quando esiste un
// conflitto concreto" + sezione 12 "tap deve portare al giorno/elemento
// reale". Le sovrapposizioni (KidOverlap) sono già calcolate per l'intera
// SeasonWeek (nessuna granularità oraria/giornaliera nel modello dati — vedi
// limite dichiarato in lib/nextgen/calendar-weeks.ts, hasConflict è già
// applicato a TUTTI i giorni feriali della stessa settimana in
// buildCalendarMonths): questa funzione filtra le KidOverlap che appartengono
// alla settimana stagionale `weekIndex` (null se la settimana della vista
// corrente non corrisponde a nessuna SeasonWeek, es. fuori stagione — in
// quel caso nessun conflitto è possibile).
export function overlapsForWeekIndex(overlaps: KidOverlap[], weekIndex: number | null): KidOverlap[] {
  if (weekIndex === null) return [];
  return overlaps.filter((o) => weekIndexFromLabel(o.weekLabel) === weekIndex);
}

// Sezione 11 — "MER 9 · ⚠ Sovrapposizione" a livello di badge settimana:
// "⚠ 1 sovrapposizione" / "⚠ N sovrapposizioni", null se non ce n'è nessuna
// (nessun warning generico, punto centrale del brief).
export function weekConflictBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 sovrapposizione" : `${count} sovrapposizioni`;
}

// Sezione 11 — dettaglio "item level" concreto per la card di un'attività
// TRAMA coperta: "Lino risulta prenotato anche in Calcio" — costruito SOLO
// dai dati reali già disponibili (KidOverlap.bookings[].activityName), mai
// un orario inventato (il modello dati non ha orari reali per i booking
// TRAMA — vedi formatOccurrenceTime in PlannerCalendarView.tsx per il
// trattamento equivalente lato impegni esterni, che HANNO un orario reale).
// null se questo bambino non ha una sovrapposizione in questa settimana
// (cella riga → niente warning).
export function weekConflictDetailForKid(
  weekOverlaps: KidOverlap[],
  kidId: string,
  gender?: KidGender
): string | null {
  const entry = weekOverlaps.find((o) => o.kidId === kidId);
  if (!entry) return null;
  const otherNames = entry.bookings.map((b) => b.activityName);
  return `${entry.kidName} risulta ${overlapVerb(gender)} anche in ${formatBookingNames(otherNames)}`;
}

// Sezione 13 — "5 attività · 4 giorni · 1 sovrapposizione", SOLO dati già
// disponibili (righe agenda già costruite da buildAgendaRows per ciascuno
// dei 7 giorni + il conteggio conflitti sopra). Stringa vuota se la
// settimana non ha alcuna attività — il chiamante mostra l'empty state
// (sezione 16) invece di questo riepilogo, mai "0 attività · 0 giorni".
export function buildWeekSummaryLabel(dayRows: AgendaRow[][], conflictCount: number): string {
  const activityCount = dayRows.reduce((sum, rows) => sum + rows.length, 0);
  if (activityCount === 0) return "";
  const daysWithContent = dayRows.filter((rows) => rows.length > 0).length;
  const parts = [
    `${activityCount} attività`,
    `${daysWithContent} ${daysWithContent === 1 ? "giorno" : "giorni"}`,
  ];
  const conflictLabel = weekConflictBadgeLabel(conflictCount);
  if (conflictLabel) parts.push(conflictLabel);
  return parts.join(" · ");
}

// Sezione 12 — "tap sul badge conflitto porta al primo giorno interessato":
// indice (0=Lun..6=Dom) del primo giorno della settimana che ha almeno una
// riga TRAMA in conflitto, null se nessuno (nessuna navigazione, il badge
// stesso non viene mostrato in quel caso — vedi weekConflictBadgeLabel).
export function firstConflictedDayIndex(dayRows: AgendaRow[][], conflictedKidIds: Set<string>): number | null {
  for (let i = 0; i < dayRows.length; i++) {
    const hasConflict = dayRows[i].some((row) => row.kind === "trama" && conflictedKidIds.has(row.kidId));
    if (hasConflict) return i;
  }
  return null;
}

// =============================================================================
// WEEK VIEW V2 — STICKY WEEK NAVIGATOR + SELECTED-DAY TIMELINE (29/09/2026,
// brief verbatim di Fabrizio dopo la validazione live del redesign sopra:
// "Week = seven day sections stacked vertically" → "Week = sticky week
// navigator + selected-day agenda", sezione 2 del nuovo brief). Le funzioni
// sopra (formatWeekDateRangeIt/overlapsForWeekIndex/weekConflictBadgeLabel/
// weekConflictDetailForKid/buildWeekSummaryLabel/firstConflictedDayIndex)
// restano INVARIATE e completamente riusate: descrivono ancora dati a
// livello di INTERA settimana (range date, sovrapposizioni, riepilogo), che
// V2 continua a mostrare esattamente come prima (header + riepilogo
// opzionale + badge conflitto). Le funzioni qui sotto sono SOLO quelle nuove
// che la vista a "un giorno selezionato per volta" richiede in più — zero
// duplicazione di ciò che esiste già.
// =============================================================================

// Sezione 5/6 del nuovo brief — intestazione del giorno selezionato:
// "MARTEDÌ 29 SETTEMBRE". Stessa convenzione minuscolo+uppercase-via-CSS già
// usata da formatWeekDateRangeIt sopra (e da formatFullDayIt in
// PlannerCalendarView.tsx, che invece abbrevia il giorno — qui il brief
// vuole il nome completo del giorno, non l'abbreviazione a 3 lettere).
const WEEKDAY_FULL_IT = [
  "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica",
];

export function formatSelectedDayHeaderIt(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const weekdayIdx = (d.getUTCDay() + 6) % 7; // 0=Dom..6=Sab -> 0=Lun..6=Dom
  const [, m, day] = dateIso.split("-").map(Number);
  return `${WEEKDAY_FULL_IT[weekdayIdx]} ${day} ${MONTH_FULL_IT[m - 1]}`;
}

// Sezione 6 — "3 impegni" sotto l'intestazione del giorno selezionato.
// Stringa vuota se il giorno non ha alcun impegno (il chiamante mostra
// l'empty state della sezione 23 invece di questa etichetta — stesso
// principio già applicato a buildWeekSummaryLabel per la settimana intera).
export function selectedDayItemsCountLabel(rows: AgendaRow[]): string {
  if (rows.length === 0) return "";
  return rows.length === 1 ? "1 impegno" : `${rows.length} impegni`;
}

// Sezione 20 — "MARTEDÌ 29 / ⚠ 1 conflitto" nell'intestazione del giorno
// selezionato. Conta SOLO le righe TRAMA di questo giorno il cui kidId è
// realmente in conflitto in questa settimana (weekConflictedKidIds, calcolato
// da overlapsForWeekIndex — nessuna precisione nuova rispetto a quella già
// disponibile: il "conflitto del giorno" è "questo bambino, in questa
// settimana, ha una doppia prenotazione reale", applicato a QUESTO giorno
// specifico perché è lì che la sua card TRAMA compare — MAI un conteggio più
// preciso di quello che il modello dati permette, vedi ROOT CAUSE ANALYSIS
// nel commento della sezione "Settimana" di PlannerCalendarView.tsx).
export function countDayConflicts(rows: AgendaRow[], conflictedKidIds: Set<string>): number {
  return rows.filter((row) => row.kind === "trama" && conflictedKidIds.has(row.kidId)).length;
}

// Sezione 20 — "⚠ 1 conflitto" / "⚠ N conflitti", null se zero (mai un
// warning generico senza un conflitto reale dietro, stesso principio di
// weekConflictBadgeLabel sopra).
export function dayConflictBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 conflitto" : `${count} conflitti`;
}

// Sezione 8 EVENT TYPE / sezione 9 CATEGORY AUDIT — cue di categoria
// SECONDARIO per una riga TRAMA. ROOT CAUSE ANALYSIS (letta per intero prima
// di scrivere questa funzione, vedi anche il commento su
// KidCoverage.categoryLabel in lib/data/planner.ts): le attività Partner/
// TRAMA hanno un vero tag admin-curated (join activities -> activity_tags ->
// tags, tabella `tags`: id/label/emoji/bg_color — supabase/schema.sql riga
// 216) già usato dalle card Discovery (lib/data/activities.ts#mapRow,
// tagPills) — MA quella tabella non ha alcuna colonna "famiglia/gruppo": ogni
// tag è testo libero scelto dall'admin (es. "Judo", "Piscina", "Inglese"),
// non un insieme chiuso di 5-6 famiglie. Creare una mappatura
// tag→famiglia (es. "Judo"→"Sport") qui significherebbe INFERIRE una
// categoria da una stringa senza alcun layer di normalizzazione esistente
// che lo faccia già — esplicitamente vietato dalla sezione 9 del brief
// ("NON inferire categoria da stringhe titolo... a meno che un layer di
// normalizzazione esistente non lo faccia già"). Trattamento scelto, onesto
// verso il dato: mostrare il tag REALE così com'è (label+emoji, mai
// inventati) come singolo cue secondario — se l'attività non ha alcun tag
// assegnato, null (fallback neutro, sezione 11: "nessuna icona inventata,
// nessun colore indovinato"). Se il tag ha un'etichetta ma l'admin non ha
// scelto un emoji, si usa un pallino neutro "•" (stesso trattamento "Altro"
// già elencato come esempio nella sezione 8 del brief) invece di indovinarne
// uno.
export interface CategoryChip {
  emoji: string;
  label: string;
}

export function categoryChipForTramaRow(row: { categoryLabel?: string; categoryEmoji?: string }): CategoryChip | null {
  if (!row.categoryLabel) return null;
  return { emoji: row.categoryEmoji || "•", label: row.categoryLabel };
}

// Sezione 9 — AUDIT: i Manual External Planner Items (lib/data/
// external-planner-items.ts#ExternalPlannerItem) hanno un solo campo di tipo
// reale, `kind: "activity" | "commitment"` (binario, scelto dal genitore in
// fase di creazione) — NESSUN campo categoria/tag (verificato leggendo per
// intero external-planner-items.ts e external-calendar-items-core.ts: la
// tabella external_planner_items non ha alcuna colonna categoria). Questo
// NON è la stessa cosa della tassonomia a 5-6 famiglie (Sport/Educativo/...)
// disponibile solo per le attività TRAMA — è un cue più povero ma comunque
// reale (non inferito), reso come tale: due soli valori possibili, mai
// presentati come se fossero una categoria specifica (niente "Sport"/
// "Salute" indovinati da un `kind` generico). Vedi sezione 12 del brief
// ("FUTURE MANUAL CATEGORY") per l'enhancement futuro documentato invece di
// essere implementato qui (richiederebbe un nuovo campo DB, fuori scope:
// "Nessuna migration attesa").
export function externalKindChip(kind: "activity" | "commitment"): CategoryChip {
  return kind === "commitment" ? { emoji: "📌", label: "Impegno" } : { emoji: "🎯", label: "Attività" };
}

// Sezione 4/16 — indice (0=Lun..6=Dom) di `iso` dentro `weekDates` (le 7 date
// Lun..Dom già calcolate da agendaWeekDates in lib/nextgen/calendar-weeks.ts)
// — usato per sincronizzare lo strip/il giorno selezionato senza ricalcolare
// nulla di data-sensitive qui. -1 se `iso` non appartiene a questa settimana
// (guardia difensiva, non dovrebbe mai accadere dato che weekDates è sempre
// generato dalla stessa settimana di `iso`).
export function selectedDayIndexInWeek(weekDates: string[], iso: string): number {
  return weekDates.indexOf(iso);
}
