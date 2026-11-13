// TRAMA — Feature flag: vista "Per area" (13/11/2026).
// Richiesta di Fabrizio: "Aggiungi la vista Per area accanto a Per release
// [...] Nessun flag deve sparire se non è classificato."
// Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md (Project).
//
// Logica pura, nessun I/O. La mappa area → flag è ESPLICITA (scelta di
// Fabrizio sulle 5 aree): niente euristiche sul nome. Un flag del registry
// che non compare qui finisce in "Da classificare", mai nascosto.
// L'area è solo un'etichetta di lettura: non cambia lo stato di nessun flag.

export type FlagAreaKey = "planner" | "famiglie" | "scopri" | "centri" | "piattaforma" | "da_classificare";

export interface FlagAreaDefinition {
  key: FlagAreaKey;
  label: string;
  hint: string;
  flags: readonly string[];
}

export const FLAG_AREAS: readonly FlagAreaDefinition[] = [
  {
    key: "planner",
    label: "Planner e accompagnamento",
    hint: "Planner V2, giornata, settimana tipo, chi accompagna, calendari esterni.",
    flags: [
      "PLANNER_V2_ENABLED",
      "PLANNER_DAY_VIEW_ENABLED",
      "WEEKLY_ROUTINE_ENABLED",
      "PASSAGE_RESPONSIBILITIES_ENABLED",
      "PASSAGE_PERSON_FIRST_ENABLED",
      "CHI_ACCOMPAGNA_PLUS_ENABLED",
      "PLANNER_OVERLAP_WARNING_ENABLED",
      "CALENDAR_EXPORT_ENABLED",
      "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
      "EXTERNAL_PLANNER_ITEMS_ENABLED",
      "PLACE_SEARCH_ENABLED",
    ],
  },
  {
    key: "famiglie",
    label: "Famiglie e onboarding",
    hint: "Home, navigazione, profilo, ingresso, promemoria e comunicazione con le famiglie.",
    flags: [
      "HOME_V2_ENABLED",
      "NAV_V2_ENABLED",
      "PROFILE_V2_ENABLED",
      "ONBOARDING_V2_ENABLED",
      "GROUPS_V2_ENABLED",
      "DAILY_BRIEFING_ENABLED",
      "FAMILY_REMINDERS_PUSH_ENABLED",
      "RETURN_HOME_AFTER_IDLE_ENABLED",
      "PARENT_UX_FIX_ENABLED",
      "NODI_ENABLED",
      "BETA_SURVEY_ENABLED",
      "LANDING_PUBLIC_ENABLED",
    ],
  },
  {
    key: "scopri",
    label: "Scopri e Radar",
    hint: "Ricerca attività, prenotazioni lato famiglia, Radar e dati reali di scoperta.",
    flags: ["DISCOVER_V2_ENABLED", "BOOKINGS_V2_ENABLED", "RADAR_ENABLED", "REAL_DISCOVERY_DATASET_ENABLED"],
  },
  {
    key: "centri",
    label: "Centri e messaggi",
    hint: "Portale centri, percorso pilota, conversazioni con le famiglie.",
    flags: ["PARTNER_SHELL_V2_ENABLED", "PARTNER_V2_ENABLED", "CENTER_PILOT_FLOW_ENABLED", "INQUIRY_THREADS_ENABLED"],
  },
  {
    key: "piattaforma",
    label: "Piattaforma",
    hint: "Interruttori generali, consensi, dominio, strumenti interni.",
    flags: [
      "TRAMA_ONE_ENABLED",
      "LEGAL_TERMS_GATE",
      "DOMAIN_MOVE_TRAMAPP_ENABLED",
      "NEXTGEN_CLASSIC_FALLBACK_ENABLED",
      "GLOBAL_ACTION_PROGRESS_ENABLED",
      "BUILD_INFO_BUBBLE_ENABLED",
    ],
  },
];

export const UNCLASSIFIED_AREA: FlagAreaDefinition = {
  key: "da_classificare",
  label: "Da classificare",
  hint: "Flag presenti nel registro ma non ancora assegnati a un'area.",
  flags: [],
};

export function areaOfFlag(flagName: string): FlagAreaKey {
  for (const area of FLAG_AREAS) if (area.flags.includes(flagName)) return area.key;
  return "da_classificare";
}

export interface FlagGroup<T> {
  key: string;
  label: string;
  hint?: string;
  items: T[];
}

/**
 * Raggruppa per area preservando l'ordine della mappa. Ogni elemento finisce
 * in UN solo gruppo; quelli non mappati vanno in "Da classificare", che
 * compare solo se non è vuoto.
 */
export function groupByArea<T extends { flagName: string }>(items: T[]): FlagGroup<T>[] {
  const groups: FlagGroup<T>[] = FLAG_AREAS.map((a) => ({ key: a.key, label: a.label, hint: a.hint, items: [] }));
  const rest: T[] = [];
  for (const item of items) {
    const idx = FLAG_AREAS.findIndex((a) => a.flags.includes(item.flagName));
    if (idx >= 0) groups[idx].items.push(item);
    else rest.push(item);
  }
  for (const g of groups) {
    const order = FLAG_AREAS.find((a) => a.key === g.key)!.flags;
    g.items.sort((x, y) => order.indexOf(x.flagName) - order.indexOf(y.flagName));
  }
  if (rest.length > 0) groups.push({ key: UNCLASSIFIED_AREA.key, label: UNCLASSIFIED_AREA.label, hint: UNCLASSIFIED_AREA.hint, items: rest });
  return groups.filter((g) => g.items.length > 0);
}

export interface ReleaseGroupSource {
  id: string;
  label: string;
  flagNames: string[];
}

/**
 * Raggruppa per release (stesso ordine della card Release: la più recente in
 * alto). Un flag in più release compare in ognuna; un flag in nessuna release
 * finisce in "Senza release", così non sparisce.
 */
export function groupByRelease<T extends { flagName: string }>(items: T[], releases: ReleaseGroupSource[]): FlagGroup<T>[] {
  const byName = new Map(items.map((i) => [i.flagName, i]));
  const seen = new Set<string>();
  const groups: FlagGroup<T>[] = [];
  for (const r of releases) {
    const list: T[] = [];
    for (const name of r.flagNames) {
      const item = byName.get(name);
      if (item && !list.includes(item)) {
        list.push(item);
        seen.add(name);
      }
    }
    if (list.length > 0) groups.push({ key: `release:${r.id}`, label: r.label, items: list });
  }
  const rest = items.filter((i) => !seen.has(i.flagName));
  if (rest.length > 0) groups.push({ key: "release:none", label: "Senza release", hint: "Flag non collegati a nessuna release.", items: rest });
  return groups;
}

/** Ricerca: nome flag, etichetta o descrizione, senza distinguere maiuscole. */
export function matchesFlagSearch(item: { flagName: string; label?: string; description?: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.flagName, item.label ?? "", item.description ?? ""].some((s) => s.toLowerCase().includes(q));
}
