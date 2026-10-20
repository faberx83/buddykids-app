// TRAMA — ADMIN BETA COCKPIT · Parametri dell'URL (periodo, scheda, filtro)
// e costruzione dei link, così ogni numero porta alle famiglie sottostanti.

import { isPeriodPreset, resolvePeriod, type Period, type PeriodPreset } from "@/lib/beta-cockpit/dates";
import { filterToParam, parseFilterParam, type FamilyFilter } from "@/lib/beta-cockpit/model";

export const COCKPIT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "famiglie", label: "Famiglie" },
  { key: "funnel", label: "Funnel" },
  { key: "utilizzo", label: "Utilizzo" },
  { key: "frizioni", label: "Frizioni" },
  { key: "centri", label: "Centri" },
  { key: "feedback", label: "Feedback" },
] as const;

export type CockpitTab = (typeof COCKPIT_TABS)[number]["key"];

export type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function readPeriod(sp: SearchParams, todayIso: string, betaStart: string, fallback: PeriodPreset = "7g"): Period {
  const p = one(sp.p);
  const preset = isPeriodPreset(p) ? p : fallback;
  return resolvePeriod(preset, todayIso, betaStart, { from: one(sp.da), to: one(sp.a) });
}

export function readTab(sp: SearchParams): CockpitTab {
  const t = one(sp.tab);
  return COCKPIT_TABS.some((x) => x.key === t) ? (t as CockpitTab) : "overview";
}

export function readFilter(sp: SearchParams): FamilyFilter | null {
  return parseFilterParam(one(sp.filtro));
}

export function periodQuery(period: Period): Record<string, string> {
  return period.preset === "custom" ? { p: "custom", da: period.from, a: period.to } : { p: period.preset };
}

export function cockpitHref(period: Period, opts: { tab?: CockpitTab; filter?: FamilyFilter | null } = {}): string {
  const q = new URLSearchParams(periodQuery(period));
  if (opts.tab && opts.tab !== "overview") q.set("tab", opts.tab);
  if (opts.filter) q.set("filtro", filterToParam(opts.filter));
  return `/admin/beta?${q.toString()}`;
}

/** Tabella famiglie filtrata (dal report o dall'overview). */
export function familiesHref(period: Period, filter: FamilyFilter | null): string {
  return cockpitHref(period, { tab: "famiglie", filter });
}

export function familyDetailHref(key: string): string {
  return `/admin/beta/famiglia/${encodeURIComponent(key)}`;
}
