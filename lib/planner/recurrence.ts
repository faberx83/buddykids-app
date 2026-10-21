// TRAMA — SETTIMANA TIPO, FASE A (21/10/2026, release "settimana-tipo").
// Fabrizio, con gli orari di Noemi e Bianca: "questi impegni sono gestibili
// nel planner?". Un impegno a mano aveva solo un periodo (dal… al…) e
// contava TUTTI i giorni feriali del periodo: "Ritmica il mercoledì da
// settembre a giugno" risultava ogni giorno. Ora può ripetersi ogni
// settimana in giorni scelti (anche sabato e domenica), ogni settimana o a
// settimane alterne, dentro il suo periodo.
//
// Dove si salva: external_planner_items.recurrence_rule (jsonb, già nello
// schema, mai usata prima) — nessuna migrazione. Forma:
//   { "freq": "weekly", "weekdays": [3], "interval": 1, "anchor": "2026-09-14" }
// weekdays: 1 = lunedì … 7 = domenica. interval 2 = settimane alterne a
// partire dalla settimana di `anchor` (che è "una settimana sì").
// Senza recurrence_rule tutto resta come prima (ogni giorno del periodo).
//
// La scuola (Fase A) è un impegno ricorrente speciale: source_metadata
// { "role": "school" } — vedi isSchoolMetadata.
//
// Funzioni pure, usate da agenda, Settimana, coperture, Chi accompagna,
// calendario ed export: un solo punto decide "quel giorno c'è?".

export interface WeeklyRecurrence {
  freq: "weekly";
  /** 1 = lunedì … 7 = domenica, ordinati, senza doppioni. */
  weekdays: number[];
  /** 1 = ogni settimana, 2 = settimane alterne. */
  interval: 1 | 2;
  /** Lunedì di una settimana "sì" (conta solo con interval 2). */
  anchor: string;
}

export interface RecurringRange {
  startDate: string;
  endDate: string;
  recurrence?: WeeklyRecurrence | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Al massimo un anno e mezzo di giorni espansi per impegno (protezione). */
export const MAX_OCCURRENCE_SPAN_DAYS = 550;

export const WEEKDAY_LABELS_IT: Record<number, { short: string; letter: string; long: string }> = {
  1: { short: "lun", letter: "L", long: "lunedì" },
  2: { short: "mar", letter: "M", long: "martedì" },
  3: { short: "mer", letter: "M", long: "mercoledì" },
  4: { short: "gio", letter: "G", long: "giovedì" },
  5: { short: "ven", letter: "V", long: "venerdì" },
  6: { short: "sab", letter: "S", long: "sabato" },
  7: { short: "dom", letter: "D", long: "domenica" },
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunedì … 7 = domenica. */
export function isoWeekday(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOfIso(iso: string): string {
  return addDaysIso(iso, -(isoWeekday(iso) - 1));
}

function weeksBetween(aMonday: string, bMonday: string): number {
  const a = Date.parse(aMonday + "T00:00:00Z");
  const b = Date.parse(bMonday + "T00:00:00Z");
  return Math.round((b - a) / (7 * 86400000));
}

/** Legge recurrence_rule dal database; qualunque forma non valida = nessuna ricorrenza. */
export function parseRecurrence(raw: unknown): WeeklyRecurrence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.freq !== "weekly" || !Array.isArray(r.weekdays)) return null;
  const weekdays = Array.from(new Set(r.weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))).sort((a, b) => a - b);
  if (weekdays.length === 0) return null;
  const interval = r.interval === 2 ? 2 : 1;
  const anchor = typeof r.anchor === "string" && ISO.test(r.anchor) ? mondayOfIso(r.anchor) : null;
  if (interval === 2 && !anchor) return null;
  return { freq: "weekly", weekdays, interval, anchor: anchor ?? "1970-01-05" };
}

/** Forma da salvare in recurrence_rule (null = nessuna ricorrenza). */
export function serializeRecurrence(r: WeeklyRecurrence | null | undefined): Record<string, unknown> | null {
  if (!r) return null;
  const parsed = parseRecurrence(r);
  return parsed ? { freq: "weekly", weekdays: parsed.weekdays, interval: parsed.interval, anchor: parsed.anchor } : null;
}

/** C'è quel giorno? Senza ricorrenza: ogni giorno del periodo (comportamento di sempre). */
export function occursOn(item: RecurringRange, iso: string): boolean {
  if (iso < item.startDate || iso > item.endDate) return false;
  const r = item.recurrence;
  if (!r) return true;
  if (!r.weekdays.includes(isoWeekday(iso))) return false;
  if (r.interval === 2) return weeksBetween(r.anchor, mondayOfIso(iso)) % 2 === 0;
  return true;
}

/** I giorni in cui c'è, fra `from` e `to` compresi (e dentro il suo periodo). */
export function occurrenceDates(item: RecurringRange, from: string, to: string): string[] {
  const start = item.startDate > from ? item.startDate : from;
  const end = item.endDate < to ? item.endDate : to;
  const out: string[] = [];
  let guard = 0;
  for (let d = start; d <= end && guard < MAX_OCCURRENCE_SPAN_DAYS; d = addDaysIso(d, 1), guard += 1) {
    if (occursOn(item, d)) out.push(d);
  }
  return out;
}

/** "ogni mercoledì", "lun e mer", "venerdì, settimane alterne". */
export function recurrenceLabel(r: WeeklyRecurrence | null | undefined): string | null {
  if (!r) return null;
  const days = r.weekdays.map((d) => WEEKDAY_LABELS_IT[d]);
  const list =
    days.length === 1
      ? `ogni ${days[0].long}`
      : days.length === 5 && r.weekdays.join() === "1,2,3,4,5"
        ? "dal lunedì al venerdì"
        : `${days.slice(0, -1).map((d) => d.short).join(", ")} e ${days[days.length - 1].short}`;
  return r.interval === 2 ? `${list}, settimane alterne` : list;
}

// ─── Scuola (impegno ricorrente speciale) ──────────────────────────────

export const SCHOOL_ROLE = "school";

export function isSchoolMetadata(meta: unknown): boolean {
  return Boolean(meta && typeof meta === "object" && (meta as Record<string, unknown>).role === SCHOOL_ROLE);
}

/**
 * Periodo dell'anno scolastico che contiene `todayIso`: dal 1 settembre al
 * 30 giugno (le chiusure vere arrivano dal calendario scolastico). Da luglio
 * ad agosto propone l'anno che inizia a settembre.
 */
export function schoolYearRange(todayIso: string): { startDate: string; endDate: string } {
  const y = Number(todayIso.slice(0, 4));
  const m = Number(todayIso.slice(5, 7));
  const startYear = m >= 7 ? y : y - 1;
  return { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-06-30` };
}
