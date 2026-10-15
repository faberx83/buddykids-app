// TRAMA — HOME V2, riepilogo "Ponti e vacanze" (14/10/2026, richiesta di
// Fabrizio dopo la verifica dal vivo). Fuori dalla stagione estiva la Home
// restava senza riepilogo: il Planner conosce solo le settimane d'estate.
// Qui il periodo sono le prossime settimane di scuola e contano SOLO i
// giorni in cui la scuola è chiusa (ponti, vacanze), letti dal calendario
// scolastico già esistente. Nessuna tabella nuova, nessuna scrittura.
//
// Regole:
//   - una chiusura è "organizzata" se, per ogni figlio a casa, ogni giorno
//     feriale chiuso è coperto da una prenotazione non rifiutata o da un
//     impegno aggiunto a mano che occupa la giornata (tutto il giorno o
//     almeno MIN_COVER_MINUTES); "da completare" se lo è solo in parte;
//     "da organizzare" se per niente;
//   - le settimane normali di scuola sono grigie e non contano;
//   - orizzonte: fino alla fine della prima vacanza lunga (>= 5 giorni
//     feriali, di solito Natale) entro HORIZON_MAX_DAYS, altrimenti
//     HORIZON_DEFAULT_DAYS da oggi.
// Logica pura, testata in tests/one/home-v2.spec.ts (HV2-32…).

import type { SchoolClosureInterval } from "@/lib/school-calendar/need-core";
import type { PeriodWeekState, SeasonSummaryCell, SeasonSummaryModel, SeasonSummaryMonth } from "@/lib/nextgen/season-summary";

export const HOLIDAY_MAX_SPAN_DAYS = 21;
export const HOLIDAY_LONG_WEEKDAYS = 5;
export const HORIZON_MAX_DAYS = 120;
export const HORIZON_DEFAULT_DAYS = 90;
export const MIN_COVER_MINUTES = 240;

const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export type ClosureState = "organized" | "to_complete" | "to_organize";

export interface ClosurePeriod {
  startDate: string;
  endDate: string;
  labels: string[];
  kidIds: string[];
  /** Giorni feriali chiusi, per figlio. */
  weekdaysByKid: Record<string, string[]>;
  weekdayCount: number;
}

export interface ClosurePeriodWithState extends ClosurePeriod {
  state: ClosureState;
}

/** Un giorno coperto per alcuni figli (prenotazione o impegno). */
export interface CoverageEntry {
  /** Vuoto = tutta la famiglia. */
  kidIds: string[];
  dates: string[];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function spanDays(start: string, end: string): number {
  return Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000) + 1;
}

function isWeekday(iso: string): boolean {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return day >= 1 && day <= 5;
}

export function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWeekday(d)) out.push(d);
  return out;
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Chiusure non ancora finite (in corso o future), escluse estate e
 * intervalli più lunghi di HOLIDAY_MAX_SPAN_DAYS. Le chiusure contigue o
 * sovrapposte, anche di figli diversi, diventano un unico periodo.
 */
export function listClosurePeriods(
  closuresByKid: { kidId: string; closures: SchoolClosureInterval[] }[],
  todayIso: string
): ClosurePeriod[] {
  const raw: { kidId: string; startDate: string; endDate: string; label: string }[] = [];
  for (const { kidId, closures } of closuresByKid) {
    for (const c of closures) {
      if (c.kind === "summer_break") continue;
      if (spanDays(c.startDate, c.endDate) > HOLIDAY_MAX_SPAN_DAYS) continue;
      if (c.endDate < todayIso) continue;
      raw.push({ kidId, startDate: c.startDate, endDate: c.endDate, label: c.label });
    }
  }
  raw.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const groups: { startDate: string; endDate: string; items: typeof raw }[] = [];
  for (const r of raw) {
    const last = groups[groups.length - 1];
    if (last && r.startDate <= addDays(last.endDate, 1)) {
      if (r.endDate > last.endDate) last.endDate = r.endDate;
      last.items.push(r);
    } else {
      groups.push({ startDate: r.startDate, endDate: r.endDate, items: [r] });
    }
  }

  const periods: ClosurePeriod[] = [];
  for (const g of groups) {
    if (spanDays(g.startDate, g.endDate) > HOLIDAY_MAX_SPAN_DAYS) continue;
    const weekdaysByKid: Record<string, string[]> = {};
    const labels: string[] = [];
    for (const it of g.items) {
      if (it.label && !labels.includes(it.label)) labels.push(it.label);
      const days = weekdaysBetween(it.startDate, it.endDate).filter((d) => d >= todayIso);
      const set = new Set([...(weekdaysByKid[it.kidId] ?? []), ...days]);
      weekdaysByKid[it.kidId] = Array.from(set).sort();
    }
    const kidIds = Object.keys(weekdaysByKid).filter((k) => weekdaysByKid[k].length > 0);
    if (kidIds.length === 0) continue; // solo weekend o giorni già passati
    const allDays = new Set(kidIds.flatMap((k) => weekdaysByKid[k]));
    periods.push({ startDate: g.startDate, endDate: g.endDate, labels, kidIds, weekdaysByKid, weekdayCount: allDays.size });
  }
  return periods;
}

export function closureState(period: ClosurePeriod, coverage: CoverageEntry[]): ClosureState {
  let total = 0;
  let covered = 0;
  for (const kidId of period.kidIds) {
    for (const day of period.weekdaysByKid[kidId] ?? []) {
      total += 1;
      const ok = coverage.some((c) => (c.kidIds.length === 0 || c.kidIds.includes(kidId)) && c.dates.includes(day));
      if (ok) covered += 1;
    }
  }
  if (total === 0 || covered === total) return "organized";
  return covered === 0 ? "to_organize" : "to_complete";
}

/** Fine del periodo mostrato: la prima vacanza lunga, se arriva presto. */
export function holidayHorizon(periods: ClosurePeriod[], todayIso: string): string {
  const limit = addDays(todayIso, HORIZON_MAX_DAYS);
  const long = periods.find((p) => p.weekdayCount >= HOLIDAY_LONG_WEEKDAYS && p.startDate <= limit);
  return long ? long.endDate : addDays(todayIso, HORIZON_DEFAULT_DAYS);
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return null;
  return bh * 60 + bm - (ah * 60 + am);
}

/** Copertura dalle prenotazioni (non annullate né rifiutate) e dagli impegni
 *  che occupano la giornata. Un'ora di nuoto non "organizza" un ponte. */
export function buildCoverage(input: {
  bookings: {
    status: string;
    partnerDecision: string;
    kidIds: string[];
    weeks: { startDate: string; endDate: string }[];
    dayDates: string[];
  }[];
  externalItems: {
    startDate: string;
    endDate: string;
    allDay: boolean;
    startTime: string | null;
    endTime: string | null;
    kidIds: string[];
  }[];
}): CoverageEntry[] {
  const out: CoverageEntry[] = [];
  for (const b of input.bookings) {
    if (b.status === "cancelled" || b.partnerDecision === "rejected") continue;
    const dates = [...b.weeks.flatMap((w) => weekdaysBetween(w.startDate, w.endDate)), ...b.dayDates];
    if (dates.length > 0) out.push({ kidIds: b.kidIds, dates });
  }
  for (const i of input.externalItems) {
    const minutes = minutesBetween(i.startTime, i.endTime);
    if (!i.allDay && (minutes === null || minutes < MIN_COVER_MINUTES)) continue;
    out.push({ kidIds: i.kidIds, dates: weekdaysBetween(i.startDate, i.endDate) });
  }
  return out;
}

/** "7–8 dicembre", "23 dicembre – 6 gennaio", "7 dicembre". */
export function closureRangeLabel(startIso: string, endIso: string): string {
  const a = new Date(startIso + "T00:00:00Z");
  const b = new Date(endIso + "T00:00:00Z");
  if (startIso === endIso) return `${a.getUTCDate()} ${MONTHS_IT[a.getUTCMonth()]}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${MONTHS_IT[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()].slice(0, 3)}`;
}

const SEVERITY: Record<ClosureState, number> = { organized: 0, to_complete: 1, to_organize: 2 };

/**
 * Riepilogo "Ponti e vacanze" nello stesso formato del riepilogo estivo
 * (SeasonSummaryCard): una cella per settimana, grigia se è scuola normale,
 * colorata con lo stato della chiusura che contiene. null se nel periodo
 * non c'è nessuna chiusura.
 */
export function buildHolidaySummary(input: {
  periods: ClosurePeriodWithState[];
  todayIso: string;
}): SeasonSummaryModel | null {
  const horizon = holidayHorizon(input.periods, input.todayIso);
  const inRange = input.periods.filter((p) => p.startDate <= horizon);
  if (inRange.length === 0) return null;

  const cells: SeasonSummaryCell[] = [];
  const months: SeasonSummaryMonth[] = [];
  let index = 0;
  for (let monday = mondayOf(input.todayIso); monday <= horizon; monday = addDays(monday, 7)) {
    const friday = addDays(monday, 4);
    const touching = inRange.filter((p) => p.kidIds.some((k) => p.weekdaysByKid[k].some((d) => d >= monday && d <= friday)));
    let state: PeriodWeekState = "school";
    if (touching.length > 0) {
      const worst = touching.reduce((w, p) => (SEVERITY[p.state] > SEVERITY[w] ? p.state : w), "organized" as ClosureState);
      state = worst;
    }
    cells.push({ index: index++, state, dateRange: `${shortDate(monday)} – ${shortDate(friday)}`, closure: touching.length > 0, weekStart: monday });
    const label = MONTHS_IT[Number(monday.slice(5, 7)) - 1];
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  const count = (s: ClosureState) => inRange.filter((p) => p.state === s).length;
  // Prima chiusura che chiede ancora qualcosa: il Planner la usa per
  // "Organizza" (in Home c'è già la card "Prossima chiusura").
  const firstOpen = inRange.find((p) => p.state !== "organized" && p.endDate >= input.todayIso) ?? null;
  return {
    state: "progress",
    title: "Ponti e vacanze",
    rangeLabel: `fino al ${shortDate(horizon)}`,
    unitLabel: inRange.length === 1 ? "chiusura organizzata" : "chiusure organizzate",
    cells,
    months,
    organizedCount: count("organized"),
    neededCount: inRange.length,
    toCompleteCount: count("to_complete"),
    toOrganizeCount: count("to_organize"),
    firstAttention: firstOpen
      ? {
          index: inRange.indexOf(firstOpen),
          startDate: firstOpen.startDate,
          dateRange: closureRangeLabel(firstOpen.startDate, firstOpen.endDate),
          state: firstOpen.state === "to_complete" ? "to_complete" : "to_organize",
        }
      : null,
    isOver: false,
  };
}

/** Le chiusure mostrate nel riepilogo (entro l'orizzonte), con il loro stato. */
export function holidayPeriodsInRange(periods: ClosurePeriodWithState[], todayIso: string): ClosurePeriodWithState[] {
  const horizon = holidayHorizon(periods, todayIso);
  return periods.filter((p) => p.startDate <= horizon);
}
