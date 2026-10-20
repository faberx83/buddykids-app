// TRAMA — ADMIN BETA COCKPIT · Triage dei feedback. ADAPT di beta_feedback:
// nessun sistema parallelo. Cinque stati (migration 46) mappati sui tre
// storici, che restano quelli mostrati alle famiglie.

import type { BetaFeedbackCategory } from "@/lib/nextgen/beta-feedback-shared";

export type CockpitFeedbackStatus = "nuovo" | "da_capire" | "in_gestione" | "risolto" | "non_ora";

export const FEEDBACK_STATUS_DEF: { value: CockpitFeedbackStatus; label: string; cls: string }[] = [
  { value: "nuovo", label: "Nuovo", cls: "bg-[#E8F0FE] text-[#1A4FB0]" },
  { value: "da_capire", label: "Da capire", cls: "bg-orange-light text-trama-orange" },
  { value: "in_gestione", label: "Da fare", cls: "bg-[#F0EEFF] text-[#5B4FB0]" },
  { value: "risolto", label: "Fatto", cls: "bg-green-light text-[#2d8f52]" },
  { value: "non_ora", label: "Non ora", cls: "bg-[#F1F3F6] text-ink-2" },
];

/** Stati che esistono solo dopo la migration 46. */
export const EXTENDED_STATUSES: CockpitFeedbackStatus[] = ["da_capire", "non_ora"];

export function isCockpitFeedbackStatus(v: unknown): v is CockpitFeedbackStatus {
  return FEEDBACK_STATUS_DEF.some((s) => s.value === v);
}

/** Per le viste a tre stati (famiglie, coda storica): Da capire → In gestione, Non ora → Risolto. */
export function toLegacyFeedbackStatus(v: string): "nuovo" | "in_gestione" | "risolto" {
  if (v === "da_capire") return "in_gestione";
  if (v === "non_ora") return "risolto";
  if (v === "in_gestione" || v === "risolto") return v;
  return "nuovo";
}

export type FeedbackView = "tutti" | "problema" | "idea" | "manca" | "altro" | "survey";

export const FEEDBACK_VIEWS: { key: FeedbackView; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "problema", label: "Problemi" },
  { key: "idea", label: "Idee" },
  { key: "manca", label: "Cosa manca" },
  { key: "altro", label: "Altro" },
  { key: "survey", label: "Survey" },
];

export interface CockpitFeedbackRow {
  id: string;
  familyKey: string | null;
  familyLabel: string | null;
  at: string;
  category: BetaFeedbackCategory | null;
  area: string;
  pagePath: string;
  message: string;
  status: CockpitFeedbackStatus;
  tags: string[];
  adminNote: string | null;
  source: "genitori" | "gestore";
  /** "survey_1" | "survey_2" per le risposte alle survey. */
  surveyId: string | null;
}

export function inFeedbackView(r: CockpitFeedbackRow, view: FeedbackView): boolean {
  if (view === "tutti") return true;
  if (view === "survey") return r.surveyId !== null;
  if (r.surveyId) return false;
  if (view === "altro") return r.category === "altro" || r.category === null;
  return r.category === view;
}

/** Tag scritti a mano: minuscoli, senza spazi ai lati, al massimo 8 da 30 caratteri. */
export function parseTags(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[,;#\n]/);
  const out: string[] = [];
  for (const p of parts) {
    const t = p
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9àèéìòù_-]/g, "")
      .slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

export interface FeedbackSummary {
  counts: Record<FeedbackView, number>;
  byStatus: Record<CockpitFeedbackStatus, number>;
  /** Aree o tag più ricorrenti, con quante famiglie distinte. */
  recurring: { label: string; kind: "area" | "tag"; items: number; families: number }[];
  families: number;
  lastAt: string | null;
}

export function summarizeFeedback(rows: CockpitFeedbackRow[]): FeedbackSummary {
  const counts = Object.fromEntries(FEEDBACK_VIEWS.map((v) => [v.key, rows.filter((r) => inFeedbackView(r, v.key)).length])) as Record<FeedbackView, number>;
  const byStatus = Object.fromEntries(FEEDBACK_STATUS_DEF.map((s) => [s.value, rows.filter((r) => r.status === s.value).length])) as Record<CockpitFeedbackStatus, number>;
  const groups = new Map<string, { label: string; kind: "area" | "tag"; items: number; families: Set<string> }>();
  const add = (key: string, label: string, kind: "area" | "tag", fam: string | null) => {
    const g = groups.get(key) ?? { label, kind, items: 0, families: new Set<string>() };
    g.items += 1;
    if (fam) g.families.add(fam);
    groups.set(key, g);
  };
  for (const r of rows) {
    if (r.surveyId) continue;
    add(`area:${r.area}`, r.area, "area", r.familyKey);
    for (const t of r.tags) add(`tag:${t}`, `#${t}`, "tag", r.familyKey);
  }
  const recurring = Array.from(groups.values())
    .filter((g) => g.items >= 2)
    .map((g) => ({ label: g.label, kind: g.kind, items: g.items, families: g.families.size }))
    .sort((a, b) => b.families - a.families || b.items - a.items)
    .slice(0, 8);
  const sorted = [...rows].sort((a, b) => b.at.localeCompare(a.at));
  return {
    counts,
    byStatus,
    recurring,
    families: new Set(rows.map((r) => r.familyKey).filter(Boolean)).size,
    lastAt: sorted[0]?.at ?? null,
  };
}
