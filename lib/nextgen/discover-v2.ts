// TRAMA — SCOPRI V2 (14/10/2026, tavole "TRAMA Scopri e Prenotazioni V2",
// 1 e 2). Logica pura di "Per quando": i periodi proposti in cima a Scopri
// (le prossime chiusure della scuola, le prossime settimane, l'estate) e il
// filtro per data su attività Partner (settimane e giorni aperti), Scoperte
// TRAMA e scoperte della community. Nessuna query.
// Testata in tests/one/scopri-prenotazioni-v2.spec.ts.

import { closureRangeLabel } from "@/lib/nextgen/holiday-summary";

export interface DateRange {
  start: string;
  end: string;
}

export interface DiscoverPeriod extends DateRange {
  key: string;
  /** Etichetta del bottone: "Ponte 7–8 dic", "Vacanze di Natale". */
  label: string;
  /** Titolo dei risultati: "Per il ponte del 7–8 dicembre". */
  title: string;
  kind: "closure" | "soon" | "summer" | "week";
}

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** true se almeno un intervallo aperto dell'attività tocca il periodo. */
export function activityOpenIn(ranges: DateRange[] | undefined, period: DateRange): boolean {
  return (ranges ?? []).some((r) => overlaps(r, period));
}

/** Scoperte: una data non indicata non esclude (stessa regola dei filtri esistenti). */
export function discoveryOpenIn(item: { startDate: string | null; endDate: string | null }, period: DateRange): boolean {
  if (!item.startDate && !item.endDate) return true;
  const start = item.startDate ?? item.endDate!;
  const end = item.endDate ?? item.startDate!;
  return overlaps({ start, end }, period);
}

function shortRange(start: string, end: string): string {
  const a = new Date(start + "T00:00:00Z");
  const b = new Date(end + "T00:00:00Z");
  if (start === end) return `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`;
}

/**
 * Nome breve di una chiusura per i bottoni (14/10/2026, il calendario
 * scolastico ha etichette lunghe come "Vacanze di Natale 2026/2027 (incl.
 * Natale, Santo Stefano…)"): via la parentesi e l'anno scolastico finale.
 */
export function shortClosureName(label: string): string {
  return label
    .replace(/\s*\(.*$/, "")
    .replace(/\s+\d{4}(\s*[\/–-]\s*\d{2,4})?\s*$/, "")
    .trim();
}

/**
 * I periodi di "Per quando", nell'ordine in cui servono a una famiglia:
 *   1-2. le prossime due chiusure della scuola (se indicata), entro 4 mesi;
 *   3.   le prossime 4 settimane;
 *   4.   l'estate, se non è già finita.
 * Un periodo lungo (≥ 5 giorni feriali) è "vacanze", uno corto è "ponte".
 */
export function buildDiscoverPeriods(input: {
  todayIso: string;
  closures: { startDate: string; endDate: string; labels: string[]; weekdayCount: number }[];
  summer: DateRange | null;
  summerYear: number | null;
}): DiscoverPeriod[] {
  const out: DiscoverPeriod[] = [];
  const limit = addDays(input.todayIso, 120);
  for (const c of input.closures.filter((x) => x.startDate > input.todayIso && x.startDate <= limit).slice(0, 2)) {
    const long = c.weekdayCount >= 5;
    const namedRaw = c.labels.find((l) => /natale|pasqua|carnevale/i.test(l));
    const named = namedRaw ? shortClosureName(namedRaw) : undefined;
    // Bottone il più corto possibile ("Natale", "Pasqua"): il titolo sopra i
    // risultati resta per esteso ("Per le vacanze di Natale").
    const chip = named ? named.replace(/^vacanze\s+(di|del|della)\s+/i, "") : null;
    const label = long ? (chip ? chip.charAt(0).toUpperCase() + chip.slice(1) : `Vacanze ${shortRange(c.startDate, c.endDate)}`) : `Ponte ${shortRange(c.startDate, c.endDate)}`;
    const title = long
      ? named && /^vacanze/i.test(named)
        ? `Per le ${named.charAt(0).toLowerCase()}${named.slice(1)}`
        : `Per le vacanze del ${closureRangeLabel(c.startDate, c.endDate)}`
      : `Per il ponte del ${closureRangeLabel(c.startDate, c.endDate)}`;
    out.push({ key: `chiusura-${c.startDate}`, label, title, start: c.startDate, end: c.endDate, kind: "closure" });
  }
  out.push({
    key: "prossime",
    label: "Prossime settimane",
    title: "Nelle prossime 4 settimane",
    start: input.todayIso,
    end: addDays(input.todayIso, 27),
    kind: "soon",
  });
  if (input.summer && input.summer.end >= input.todayIso) {
    out.push({
      key: "estate",
      label: input.summerYear ? `Estate ${input.summerYear}` : "Estate",
      title: input.summerYear ? `Per l'estate ${input.summerYear}` : "Per l'estate",
      start: input.summer.start,
      end: input.summer.end,
      kind: "summer",
    });
  }
  return out;
}

/** Un ?week= che non è una settimana estiva (es. "Trova attività" su un ponte). */
export function periodForWeek(weekStartIso: string): DiscoverPeriod {
  const end = addDays(weekStartIso, 6);
  return {
    key: `settimana-${weekStartIso}`,
    label: `Settimana ${shortRange(weekStartIso, end)}`,
    title: `Per la settimana ${closureRangeLabel(weekStartIso, end)}`,
    start: weekStartIso,
    end,
    kind: "week",
  };
}
