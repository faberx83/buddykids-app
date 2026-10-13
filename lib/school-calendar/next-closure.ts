// TRAMA — HOME V2 (Fase 1, 13/10/2026). "Prossima chiusura": la prima
// chiusura scolastica futura che tocca almeno un giorno feriale di un figlio
// (es. Sant'Ambrogio a Milano, il ponte dell'Immacolata, le vacanze di
// Natale). Logica pura sopra gli intervalli già prodotti da
// buildClosureIntervals (lib/school-calendar/need-core.ts): nessuna nuova
// tabella, nessun dato nuovo.
//
// Esclusi: la pausa estiva (la copre il riepilogo del periodo) e qualunque
// intervallo più lungo di NEXT_CLOSURE_MAX_DAYS giorni. Chiusure contigue
// (es. 7 e 8 dicembre) vengono unite in un unico periodo.

import type { SchoolClosureInterval } from "./need-core";

export const NEXT_CLOSURE_MAX_DAYS = 21;

export interface NextSchoolClosure {
  startDate: string;
  endDate: string;
  labels: string[];
  kidIds: string[];
  /** Giorni lun-ven dentro il periodo. */
  weekdayCount: number;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function spanDays(start: string, end: string): number {
  return Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000) + 1;
}

export function countWeekdays(start: string, end: string): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const day = new Date(d + "T00:00:00Z").getUTCDay();
    if (day >= 1 && day <= 5) n += 1;
  }
  return n;
}

interface Merged {
  startDate: string;
  endDate: string;
  labels: string[];
}

function mergeIntervals(closures: SchoolClosureInterval[]): Merged[] {
  const sorted = closures.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const out: Merged[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c.startDate <= addDays(last.endDate, 1)) {
      if (c.endDate > last.endDate) last.endDate = c.endDate;
      if (c.label && !last.labels.includes(c.label)) last.labels.push(c.label);
    } else {
      out.push({ startDate: c.startDate, endDate: c.endDate, labels: c.label ? [c.label] : [] });
    }
  }
  return out;
}

export function findNextSchoolClosure(
  closuresByKid: { kidId: string; closures: SchoolClosureInterval[] }[],
  todayIso: string
): NextSchoolClosure | null {
  const candidates: (Merged & { kidId: string })[] = [];
  for (const { kidId, closures } of closuresByKid) {
    const relevant = closures.filter(
      (c) => c.kind !== "summer_break" && spanDays(c.startDate, c.endDate) <= NEXT_CLOSURE_MAX_DAYS
    );
    for (const m of mergeIntervals(relevant)) {
      if (m.startDate <= todayIso) continue; // solo chiusure future
      if (spanDays(m.startDate, m.endDate) > NEXT_CLOSURE_MAX_DAYS) continue;
      if (countWeekdays(m.startDate, m.endDate) === 0) continue; // solo weekend: niente da organizzare
      candidates.push({ ...m, kidId });
    }
  }
  if (candidates.length === 0) return null;

  const firstStart = candidates.reduce((min, c) => (c.startDate < min ? c.startDate : min), candidates[0].startDate);
  const same = candidates.filter((c) => c.startDate === firstStart);
  const endDate = same.reduce((max, c) => (c.endDate > max ? c.endDate : max), same[0].endDate);
  const labels: string[] = [];
  for (const c of same) for (const l of c.labels) if (!labels.includes(l)) labels.push(l);
  const kidIds = Array.from(new Set(same.map((c) => c.kidId)));
  return { startDate: firstStart, endDate, labels, kidIds, weekdayCount: countWeekdays(firstStart, endDate) };
}
