// TRAMA — ADMIN BETA COCKPIT · Il modello completo di una pagina (cockpit o
// report) per un periodo. Puro: le pagine passano i dati letti da
// lib/data/beta-cockpit.ts e ricevono numeri già pronti da mostrare.

import type { CockpitThresholds } from "./definitions";
import { addDays, inPeriod, previousPeriod, romeDay, type Period } from "./dates";
import {
  areaFamilies,
  buildExecutiveSummary,
  computeAlerts,
  computeFamilyRows,
  computeFrictions,
  computeFunnel,
  computeOverview,
  computeTtv,
  computeUsage,
  familiesActiveInPeriod,
  frictionFamilies,
  type AlertRow,
  type CockpitRaw,
  type ExecutiveSummary,
  type FamilyRow,
  type FrictionKey,
  type FrictionRow,
  type FunnelRow,
  type Kpi,
  type TtvStat,
  type UsageRow,
} from "./model";
import { computeDemand, topOpportunities, type DemandRow, type DemandSignal } from "./demand";
import { summarizeFeedback, type CockpitFeedbackRow, type FeedbackSummary } from "./feedback";
import { isNegativeSurveyAnswer, SURVEYS, summarizeSurvey, type SurveyResults } from "./survey";

export interface CockpitInput {
  raw: CockpitRaw;
  feedback: CockpitFeedbackRow[];
  surveyResponses: { surveyId: string; familyKey: string | null; familyLabel: string | null; at: string; answers: Record<string, string> }[];
  demandSignals: DemandSignal[];
  zonesByFamily: Map<string, string[]>;
  thresholds: CockpitThresholds;
  betaStart: string;
}

export interface CockpitView {
  period: Period;
  todayIso: string;
  isCurrent: boolean;
  rows: FamilyRow[];
  /** Righe "a oggi" (per gli alert, che riguardano sempre il presente). */
  rowsToday: FamilyRow[];
  kpis: Kpi[];
  alerts: AlertRow[];
  funnel: FunnelRow[];
  ttv: TtvStat[];
  usage: UsageRow[];
  frictions: FrictionRow[];
  frictionMap: Record<FrictionKey, string[]>;
  technicalErrors: number;
  demand: DemandRow[];
  topDemand: DemandRow[];
  feedbackInPeriod: CockpitFeedbackRow[];
  feedbackSummary: FeedbackSummary;
  surveys: SurveyResults[];
  summary: ExecutiveSummary;
  activeInPeriod: Set<string>;
  areaFamilies: Record<string, Set<string>>;
  comparisonShown: boolean;
}

export function buildCockpitView(input: CockpitInput, period: Period, now: Date): CockpitView {
  const t = input.thresholds;
  const todayIso = romeDay(now);
  const { raw } = input;

  const rows = computeFamilyRows(raw, period.to, t);
  const rowsToday = period.to === todayIso ? rows : computeFamilyRows(raw, todayIso, t);
  const prev = previousPeriod(period);
  // Il confronto ha senso solo se anche il periodo precedente è dentro la beta.
  const prevInsideBeta = prev.from >= input.betaStart;
  const rowsPrev = prevInsideBeta ? computeFamilyRows(raw, prev.to, t) : null;
  const rowsAtStart = computeFamilyRows(raw, addDays(period.from, -1), t);

  const feedbackInPeriod = input.feedback.filter((f) => inPeriod(f.at, period));
  const feedbackPrev = input.feedback.filter((f) => inPeriod(f.at, prev)).length;
  const kpis = computeOverview(raw, rows, period, feedbackInPeriod.length, t, rowsPrev ? { rows: rowsPrev, feedbackInPeriod: feedbackPrev } : null);

  const registeredKeys = new Set(rows.filter((r) => r.registeredAt).map((r) => r.key));
  const usage = computeUsage(raw, period, registeredKeys);

  const negative = new Set<string>();
  for (const f of feedbackInPeriod) if (f.familyKey && !f.surveyId && f.category === "problema") negative.add(f.familyKey);
  for (const s of input.surveyResponses) if (s.familyKey && inPeriod(s.at, period) && isNegativeSurveyAnswer(s.surveyId, s.answers)) negative.add(s.familyKey);
  const frictions = computeFrictions(rows, rowsAtStart, t, now, negative);
  const frictionMap = frictionFamilies(rows, t, now, negative);

  const newFeedback = input.feedback.filter((f) => f.status === "nuovo").length;
  const alerts = computeAlerts(rowsToday, t, now, newFeedback);

  const funnel = computeFunnel(rows);
  const ttv = computeTtv(rows);

  const signalsUpTo = input.demandSignals.filter((s) => romeDay(s.at) <= period.to);
  const demand = computeDemand(signalsUpTo, input.zonesByFamily);
  const topDemand = topOpportunities(demand);

  const surveys = SURVEYS.map((s) =>
    summarizeSurvey(
      s,
      input.surveyResponses.filter((r) => r.surveyId === s.id && romeDay(r.at) <= period.to)
    )
  );

  const summary = buildExecutiveSummary({
    kpis,
    usage,
    funnel,
    frictions,
    topDemand: topDemand[0] ? { label: topDemand[0].label, families: topDemand[0].families } : null,
    periodLabel: period.label,
    t,
  });

  return {
    period,
    todayIso,
    isCurrent: period.to === todayIso,
    rows,
    rowsToday,
    kpis,
    alerts,
    funnel,
    ttv,
    usage,
    frictions,
    frictionMap,
    technicalErrors: raw.technicalErrors.filter((at) => inPeriod(at, period)).length,
    demand,
    topDemand,
    feedbackInPeriod,
    feedbackSummary: summarizeFeedback(input.feedback),
    surveys,
    summary,
    activeInPeriod: familiesActiveInPeriod(raw, period),
    areaFamilies: areaFamilies(raw, period),
    comparisonShown: kpis.some((k) => k.delta !== null),
  };
}
