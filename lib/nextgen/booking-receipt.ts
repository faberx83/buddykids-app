// TRAMA — RICEVUTA DELLA RICHIESTA (03/11/2026, report Parent del 30/10,
// UX-CROSS-003 "ricevuta richiesta senza data"): la pagina "Richiesta
// inviata" mostrava "Quando —" per una richiesta a giornate (7 dicembre),
// perché il riepilogo leggeva solo le settimane (booking_weeks) e non i
// giorni (booking_days). Logica pura: settimane o giorni, nella lingua
// dell'app. Test: tests/one/report-parent-3010.spec.ts.

const WEEKDAY = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTH = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const parts = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return { wd: WEEKDAY[d.getUTCDay()], day: d.getUTCDate(), month: MONTH[d.getUTCMonth()], m: d.getUTCMonth() };
};

/** "lunedì 7 dicembre"; più giorni nello stesso mese "7 e 8 dicembre", "7, 9 e 10 dicembre"; mesi diversi "30 novembre e 1 dicembre". */
export function daysLabelIt(dates: string[]): string {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) {
    const p = parts(sorted[0]);
    return `${p.wd} ${p.day} ${p.month}`;
  }
  const ps = sorted.map(parts);
  const sameMonth = ps.every((p) => p.m === ps[0].m);
  const items = sameMonth ? ps.map((p) => String(p.day)) : ps.map((p) => `${p.day} ${p.month}`);
  const joined = `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
  return sameMonth ? `${joined} ${ps[0].month}` : joined;
}

/** Il "Quando" della ricevuta: i giorni scelti, altrimenti le settimane; mai un trattino se la richiesta ha date. */
export function bookingWhenLabel(input: { weeksLabel: string | null; dayDates: string[] }): string {
  if (input.dayDates.length > 0) return daysLabelIt(input.dayDates);
  return input.weeksLabel && input.weeksLabel !== "—" ? input.weeksLabel : "—";
}
