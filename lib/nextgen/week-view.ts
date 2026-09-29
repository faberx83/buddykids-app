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
