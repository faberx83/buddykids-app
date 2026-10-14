// TRAMA — HOME V2 (Fase 1, 13/10/2026). Modello puro del "Riepilogo
// periodo", condiviso tra Home V2 e (Fase 2) vista Stagione del Planner V2.
//
// Tre stati per settimana, usati con gli stessi colori e le stesse parole
// in tutta l'app (baseline V2.1):
//   organized    — c'è un'attività per ogni figlio, il centro ha risposto e
//                  chi accompagna/ritira è deciso;
//   to_complete  — c'è un'attività ma manca qualcosa (un figlio senza
//                  attività, il centro deve rispondere, un passaggio da
//                  assegnare);
//   to_organize  — nessuna attività.
// Più not_needed per le settimane segnate "Non serve" (escluse dai conti).
//
// La copertura conta SOLO le prenotazioni TRAMA, come oggi nel Planner: gli
// impegni aggiunti a mano non contano (regola attuale, non cambiata qui).
// Il titolo del periodo è un parametro: oggi "Estate AAAA" (unico periodo
// per cui esistono dati), domani "Le prossime settimane" o altro.

/** "past": settimana già trascorsa e non organizzata — non chiede più
 *  un'azione, quindi non conta tra le "da organizzare" (segnalazione live
 *  14/10/2026). Le settimane passate organizzate restano "organized". */
export type PeriodWeekState = "organized" | "to_complete" | "to_organize" | "not_needed" | "past";

export interface SeasonSummaryWeekInput {
  index: number;
  startDate: string;
  endDate: string;
  dateRange: string;
  dismissed: boolean;
  awaitingPartnerConfirmation: boolean;
  /** Figli con una prenotazione non rifiutata in questa settimana. */
  coveredKidIds: string[];
  /** Passaggi (andata/ritorno) ancora senza responsabile in questa settimana. */
  missingCoordinationSlots: number;
}

export interface SeasonSummaryCell {
  index: number;
  state: PeriodWeekState;
  dateRange: string;
}

export interface SeasonSummaryMonth {
  label: string;
  span: number;
}

export type SeasonSummaryState = "welcome" | "not_started" | "progress";

export interface SeasonSummaryModel {
  state: SeasonSummaryState;
  title: string;
  rangeLabel: string;
  cells: SeasonSummaryCell[];
  months: SeasonSummaryMonth[];
  organizedCount: number;
  neededCount: number;
  toCompleteCount: number;
  toOrganizeCount: number;
  /** Prima settimana futura che chiede un'azione: prima le libere, poi le incomplete. */
  firstAttention: { index: number; startDate: string; dateRange: string; state: "to_complete" | "to_organize" } | null;
  /** Tutte le settimane del periodo sono già trascorse (es. l'estate vista a
   *  ottobre): la Home non mostra il riepilogo. */
  isOver: boolean;
}

const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export function computeWeekState(week: SeasonSummaryWeekInput, kidIds: string[]): PeriodWeekState {
  if (week.dismissed) return "not_needed";
  if (week.coveredKidIds.length === 0) return "to_organize";
  const everyKidCovered = kidIds.length === 0 || kidIds.every((id) => week.coveredKidIds.includes(id));
  if (!everyKidCovered || week.awaitingPartnerConfirmation || week.missingCoordinationSlots > 0) return "to_complete";
  return "organized";
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()].slice(0, 3)}`;
}

export function periodTitleForSeason(weeks: { startDate: string }[]): string {
  const year = weeks[0]?.startDate.slice(0, 4);
  return year ? `Estate ${year}` : "Le prossime settimane";
}

export function buildSeasonSummary(input: {
  title: string;
  weeks: SeasonSummaryWeekInput[];
  kidIds: string[];
  todayIso: string;
  isNewFamily: boolean;
}): SeasonSummaryModel {
  const weeks = input.weeks.slice().sort((a, b) => a.index - b.index);
  const cells: SeasonSummaryCell[] = weeks.map((w) => {
    const base = computeWeekState(w, input.kidIds);
    const isPast = w.endDate < input.todayIso;
    return {
      index: w.index,
      state: isPast && (base === "to_organize" || base === "to_complete") ? "past" : base,
      dateRange: w.dateRange,
    };
  });

  const months: SeasonSummaryMonth[] = [];
  for (const w of weeks) {
    const label = MONTHS_IT[Number(w.startDate.slice(5, 7)) - 1];
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  const count = (s: PeriodWeekState) => cells.filter((c) => c.state === s).length;
  const organizedCount = count("organized");
  const toCompleteCount = count("to_complete");
  const toOrganizeCount = count("to_organize");
  const neededCount = cells.length - count("not_needed") - count("past");

  const future = weeks
    .map((w, i) => ({ w, state: cells[i].state }))
    .filter((x) => x.w.endDate >= input.todayIso);
  const pick =
    future.find((x) => x.state === "to_organize") ?? future.find((x) => x.state === "to_complete") ?? null;
  const firstAttention =
    pick && (pick.state === "to_organize" || pick.state === "to_complete")
      ? { index: pick.w.index, startDate: pick.w.startDate, dateRange: pick.w.dateRange, state: pick.state }
      : null;

  let state: SeasonSummaryState = "progress";
  if (input.isNewFamily) state = "welcome";
  else if (neededCount > 0 && organizedCount === 0 && toCompleteCount === 0) state = "not_started";

  return {
    state,
    title: input.title,
    rangeLabel: weeks.length > 0 ? `${shortDate(weeks[0].startDate)} – ${shortDate(weeks[weeks.length - 1].endDate)}` : "",
    cells,
    months,
    organizedCount,
    neededCount,
    toCompleteCount,
    toOrganizeCount,
    firstAttention,
    isOver: weeks.length > 0 && weeks[weeks.length - 1].endDate < input.todayIso,
  };
}
