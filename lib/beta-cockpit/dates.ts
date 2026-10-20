// TRAMA — ADMIN BETA COCKPIT. Date in Europe/Rome, periodi del report e
// finestre dei report schedulati. Logica pura: il server gira in UTC, quindi
// ogni "giorno" passa da qui (un'azione alle 00:30 del 21/11 a Roma è il 21,
// non il 20).

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

const romeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function romeParts(at: Date): { date: string; time: string } {
  const parts = romeFormatter.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Giorno (YYYY-MM-DD) in Europe/Rome di un istante ISO o Date. */
export function romeDay(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return romeParts(d).date;
}

/** Ora (HH:mm) in Europe/Rome. */
export function romeTime(at: Date): string {
  return romeParts(at).time;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Giorni tra due date (b - a), entrambe YYYY-MM-DD. */
export function diffDays(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso + "T12:00:00Z") - Date.parse(aIso + "T12:00:00Z")) / 86_400_000);
}

/** 1 = lunedì … 7 = domenica. */
export function isoWeekday(iso: string): number {
  const d = new Date(iso + "T12:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T12:00:00Z"));
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function shortDateWithWeekday(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "20–26 nov", "28 nov – 4 dic", "20 nov" */
export function rangeLabel(fromIso: string, toIso: string): string {
  if (fromIso === toIso) return shortDate(fromIso);
  const a = new Date(fromIso + "T12:00:00Z");
  const b = new Date(toIso + "T12:00:00Z");
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`;
  }
  return `${shortDate(fromIso)} – ${shortDate(toIso)}`;
}

// ── Periodi del report ────────────────────────────────────────────────────

export type PeriodPreset = "oggi" | "3g" | "7g" | "14g" | "30g" | "beta" | "custom";

export const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "oggi", label: "Oggi" },
  { key: "3g", label: "Ultimi 3 giorni" },
  { key: "7g", label: "Ultimi 7 giorni" },
  { key: "14g", label: "Ultimi 14 giorni" },
  { key: "30g", label: "Ultimi 30 giorni" },
  { key: "beta", label: "Beta completa" },
  { key: "custom", label: "Personalizzato" },
];

export interface Period {
  preset: PeriodPreset;
  /** Primo giorno incluso (Europe/Rome). */
  from: string;
  /** Ultimo giorno incluso (Europe/Rome). */
  to: string;
  label: string;
}

export function isPeriodPreset(v: unknown): v is PeriodPreset {
  return PERIOD_PRESETS.some((p) => p.key === v);
}

/**
 * Periodo richiesto. "custom" usa da/a (invertite se serve, mai oltre oggi);
 * se mancano o non sono valide si torna a "Ultimi 7 giorni".
 */
export function resolvePeriod(
  preset: PeriodPreset,
  todayIso: string,
  betaStartIso: string,
  custom?: { from?: string | null; to?: string | null }
): Period {
  const lastN = (n: number): Period => ({
    preset,
    from: addDays(todayIso, -(n - 1)),
    to: todayIso,
    label: PERIOD_PRESETS.find((p) => p.key === preset)!.label,
  });
  switch (preset) {
    case "oggi":
      return { preset, from: todayIso, to: todayIso, label: "Oggi" };
    case "3g":
      return lastN(3);
    case "7g":
      return lastN(7);
    case "14g":
      return lastN(14);
    case "30g":
      return lastN(30);
    case "beta": {
      const from = betaStartIso <= todayIso ? betaStartIso : todayIso;
      return { preset, from, to: todayIso, label: "Beta completa" };
    }
    case "custom": {
      let from = isIsoDate(custom?.from) ? custom!.from! : null;
      let to = isIsoDate(custom?.to) ? custom!.to! : null;
      if (!from || !to) return resolvePeriod("7g", todayIso, betaStartIso);
      if (from > to) [from, to] = [to, from];
      if (to > todayIso) to = todayIso;
      if (from > to) from = to;
      return { preset, from, to, label: rangeLabel(from, to) };
    }
  }
}

export function periodLength(p: Pick<Period, "from" | "to">): number {
  return diffDays(p.from, p.to) + 1;
}

/** Il periodo della stessa lunghezza subito prima. */
export function previousPeriod(p: Pick<Period, "from" | "to">): { from: string; to: string } {
  const len = periodLength(p);
  return { from: addDays(p.from, -len), to: addDays(p.from, -1) };
}

/** Un istante ISO cade nel periodo (giorni Europe/Rome, estremi inclusi)? */
export function inPeriod(at: string, p: Pick<Period, "from" | "to">): boolean {
  const d = romeDay(at);
  return d >= p.from && d <= p.to;
}

// ── Report schedulati ─────────────────────────────────────────────────────

export type ReportFrequency = "manual" | "daily" | "weekly";

export interface ReportSchedule {
  frequency: ReportFrequency;
  /** 1 = lunedì … 7 = domenica */
  weekday: number;
  /** HH:mm, Europe/Rome */
  time: string;
  betaStart: string;
}

export interface ReportWindow {
  /** Chiave stabile: "AAAA-MM-GG_AAAA-MM-GG" */
  key: string;
  from: string;
  to: string;
  /** Giorno in cui il report si chiude (all'ora indicata). */
  closesOn: string;
  closed: boolean;
  label: string;
}

/**
 * Finestre dei report dalla data di inizio beta a oggi, la più recente
 * prima. Settimanale: il report del giorno W copre i 7 giorni prima (la
 * prima finestra va dall'inizio beta al giorno prima del primo W). Giornaliero:
 * ogni giorno, chiuso il giorno dopo all'ora indicata. Manuale: nessuna.
 * Il report è sempre ricalcolato dai dati: la finestra dice solo "quali giorni".
 */
export function reportWindows(schedule: ReportSchedule, now: Date, maxWindows = 60): ReportWindow[] {
  if (schedule.frequency === "manual") return [];
  const today = romeDay(now);
  const nowTime = romeTime(now);
  if (schedule.betaStart > today) return [];
  const time = /^\d{2}:\d{2}$/.test(schedule.time) ? schedule.time : "09:00";
  const isClosed = (closesOn: string) => closesOn < today || (closesOn === today && nowTime >= time);

  const windows: ReportWindow[] = [];
  if (schedule.frequency === "daily") {
    for (let d = schedule.betaStart; d <= today; d = addDays(d, 1)) {
      const closesOn = addDays(d, 1);
      windows.push({ key: `${d}_${d}`, from: d, to: d, closesOn, closed: isClosed(closesOn), label: shortDateWithWeekday(d) });
    }
  } else {
    const weekday = schedule.weekday >= 1 && schedule.weekday <= 7 ? schedule.weekday : 5;
    let first = addDays(schedule.betaStart, 1);
    while (isoWeekday(first) !== weekday) first = addDays(first, 1);
    let from = schedule.betaStart;
    let closesOn = first;
    while (from <= today) {
      const to = addDays(closesOn, -1);
      windows.push({ key: `${from}_${to}`, from, to, closesOn, closed: isClosed(closesOn), label: rangeLabel(from, to) });
      from = closesOn;
      closesOn = addDays(closesOn, 7);
    }
  }
  return windows.reverse().slice(0, maxWindows);
}

/** L'ultima finestra chiusa (quella da mandare nell'avviso), se c'è. */
export function lastClosedWindow(schedule: ReportSchedule, now: Date): ReportWindow | null {
  return reportWindows(schedule, now).find((w) => w.closed) ?? null;
}
