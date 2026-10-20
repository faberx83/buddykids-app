// TRAMA — PLANNER V2, vista Stagione (14/10/2026). Logica pura sopra le
// settimane estive già calcolate da getPlannerData (SeasonWeek): stessi
// stati e stesse parole del riepilogo della Home (computeWeekState), più
// l'elenco completo delle settimane raggruppate per mese (raggruppamento
// solo visivo: ogni settimana resta una riga), il filtro "Da sistemare" e
// la copertura per figlio. Testata in tests/one/planner-v2.spec.ts.

import { computeWeekState, type PeriodWeekState, type SeasonSummaryWeekInput } from "@/lib/nextgen/season-summary";

const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export interface SeasonWeekLike {
  index: number;
  startDate: string;
  endDate: string;
  dismissed: boolean;
  awaitingPartnerConfirmation: boolean;
  coveredKids: { kidId: string; activityName: string; partnerDecision: string }[];
}

export interface SeasonRow {
  index: number;
  startDate: string;
  endDate: string;
  /** "8 – 12 giugno" */
  dateLabel: string;
  state: PeriodWeekState;
  isPast: boolean;
  /** "Campus Sport · Giulia, Sofia" per attività, al massimo 2 righe. */
  lines: string[];
  /** Figli senza niente in questa settimana (per "Da completare"). */
  missingKidNames: string[];
}

export interface SeasonMonthGroup {
  label: string;
  rows: SeasonRow[];
}

export type SeasonFilter = "all" | "to_fix";

function dateLabel(startIso: string, endIso: string): string {
  const a = new Date(startIso + "T00:00:00Z");
  const b = new Date(endIso + "T00:00:00Z");
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()} – ${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${MONTHS_IT[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}`;
}

export function toSummaryWeek(
  w: SeasonWeekLike,
  missingCoordinationSlots: number,
  kidFilter: string | null
): SeasonSummaryWeekInput {
  const covered = w.coveredKids.filter((k) => k.partnerDecision !== "rejected").map((k) => k.kidId);
  return {
    index: w.index,
    startDate: w.startDate,
    endDate: w.endDate,
    dateRange: dateLabel(w.startDate, w.endDate),
    dismissed: w.dismissed,
    awaitingPartnerConfirmation: w.awaitingPartnerConfirmation,
    coveredKidIds: Array.from(new Set(kidFilter ? covered.filter((k) => k === kidFilter) : covered)),
    missingCoordinationSlots,
  };
}

export function buildSeasonRows(input: {
  weeks: SeasonWeekLike[];
  kids: { id: string; name: string }[];
  kidFilter: string | null;
  todayIso: string;
  /** Passaggi senza responsabile per settimana (computeRolesToCover). */
  missingSlotsByStart: Record<string, number>;
  filter: SeasonFilter;
}): SeasonMonthGroup[] {
  const kidIds = input.kidFilter ? [input.kidFilter] : input.kids.map((k) => k.id);
  const nameById = Object.fromEntries(input.kids.map((k) => [k.id, k.name]));
  const groups: SeasonMonthGroup[] = [];
  for (const w of input.weeks.slice().sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const summaryWeek = toSummaryWeek(w, input.missingSlotsByStart[w.startDate] ?? 0, input.kidFilter);
    const isPast = w.endDate < input.todayIso;
    const base = computeWeekState(summaryWeek, kidIds);
    const state: PeriodWeekState = isPast && (base === "to_organize" || base === "to_complete") ? "past" : base;
    if (input.filter === "to_fix" && state !== "to_organize" && state !== "to_complete") continue;

    const byActivity = new Map<string, string[]>();
    for (const c of w.coveredKids) {
      if (c.partnerDecision === "rejected") continue;
      if (input.kidFilter && c.kidId !== input.kidFilter) continue;
      const names = byActivity.get(c.activityName) ?? [];
      const n = nameById[c.kidId];
      if (n && !names.includes(n)) names.push(n);
      byActivity.set(c.activityName, names);
    }
    const lines = Array.from(byActivity.entries())
      .slice(0, 2)
      .map(([activity, names]) => (names.length > 0 ? `${activity} · ${names.join(", ")}` : activity));
    const missingKidNames = kidIds.filter((id) => !summaryWeek.coveredKidIds.includes(id)).map((id) => nameById[id]).filter(Boolean);

    const label = MONTHS_IT[Number(w.startDate.slice(5, 7)) - 1];
    const last = groups[groups.length - 1];
    const row: SeasonRow = {
      index: w.index,
      startDate: w.startDate,
      endDate: w.endDate,
      dateLabel: summaryWeek.dateRange,
      state,
      isPast,
      lines,
      missingKidNames: summaryWeek.coveredKidIds.length > 0 ? missingKidNames : [],
    };
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

/** "Giulia 7 di 10": settimane in cui il figlio ha qualcosa, sulle settimane che servono. */
export function coverageByKid(input: {
  weeks: SeasonWeekLike[];
  kids: { id: string; name: string }[];
}): { kidId: string; name: string; covered: number; needed: number }[] {
  const needed = input.weeks.filter((w) => !w.dismissed);
  return input.kids.map((k) => ({
    kidId: k.id,
    name: k.name,
    needed: needed.length,
    covered: needed.filter((w) => w.coveredKids.some((c) => c.kidId === k.id && c.partnerDecision !== "rejected")).length,
  }));
}

// ─── Salvati (preferiti non ancora nel Planner) ─────────────────────────

export interface SavedItemInput {
  kind: "partner" | "curated" | "community";
  /** Partner: activities.id (dbId). Curated: curated_lead_id. Community: id della scoperta. */
  ref: string;
  /** Altri riferimenti con cui la stessa cosa può essere già nel Planner. */
  altRefs?: string[];
  /** 20/10/2026: nome mostrato nella card del Planner. */
  title?: string;
  /** 20/10/2026: quando è disponibile (settimane del centro, giorni aperti, date della scoperta). Vuoto = non si sa. */
  ranges?: { startDate: string; endDate: string }[];
}

/**
 * Quanti preferiti non sono ancora né prenotati né nel Planner come
 * impegno. Solo cose con una data possibile: niente "impegni senza data"
 * (external_planner_items.start_date è obbligatoria).
 */
/** I salvati non ancora prenotati né nel Planner (stessa regola di countSavedNotInPlanner). */
export function savedNotInPlanner(input: {
  saved: SavedItemInput[];
  bookedActivityDbIds: string[];
  externalSourceRefs: string[];
}): SavedItemInput[] {
  const booked = new Set(input.bookedActivityDbIds);
  const inPlanner = new Set(input.externalSourceRefs);
  return input.saved.filter((s) => {
    const refs = [s.ref, ...(s.altRefs ?? [])];
    if (s.kind === "partner") return !booked.has(s.ref);
    return !refs.some((r) => inPlanner.has(r));
  });
}

/**
 * 20/10/2026 — Fabrizio: "quella attività non salvata cos'è? Serve? Dipende
 * dalla disponibilità o dalla necessità della famiglia, altrimenti no".
 * La card Salvati del Planner compare solo per i salvati disponibili nella
 * settimana che si guarda (dal lunedì alla domenica); `coversNeed` = sono
 * disponibili anche in un giorno che per qualcuno è ancora scoperto (scuola
 * chiusa senza niente). Un salvato senza date note non compare qui (resta
 * in Salvati).
 */
export function savedForWeek<T extends { ranges?: { startDate: string; endDate: string }[] }>(
  items: T[],
  mondayIso: string,
  uncoveredDates: string[] = []
): { items: T[]; coversNeed: boolean } {
  const end = (() => {
    const d = new Date(mondayIso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const inWeek = items.filter((s) => (s.ranges ?? []).some((r) => r.startDate <= end && r.endDate >= mondayIso));
  const coversNeed = inWeek.some((s) => (s.ranges ?? []).some((r) => uncoveredDates.some((d) => r.startDate <= d && d <= r.endDate)));
  return { items: inWeek, coversNeed };
}

export function countSavedNotInPlanner(input: {
  saved: SavedItemInput[];
  bookedActivityDbIds: string[];
  externalSourceRefs: string[];
}): number {
  const booked = new Set(input.bookedActivityDbIds);
  const inPlanner = new Set(input.externalSourceRefs);
  return input.saved.filter((s) => {
    const refs = [s.ref, ...(s.altRefs ?? [])];
    if (s.kind === "partner") return !booked.has(s.ref);
    return !refs.some((r) => inPlanner.has(r));
  }).length;
}
