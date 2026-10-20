// TRAMA — ADMIN BETA COCKPIT · Domanda verso i centri ("accerchiamento").
// Non conta i centri citati: conta quante FAMIGLIE DISTINTE citano lo stesso
// centro o la stessa attività, da qualunque fonte. Chiave di aggregazione =
// la stessa normalizzazione dei Centri suggeriti (minuscole, niente accenti
// né punteggiatura), così "Piscina Cozzi" e "piscina cozzi!" coincidono.
// Non è un CRM: nessuno stato commerciale, solo densità.

export type DemandSignalType =
  | "partner_salvato"
  | "partner_richiesta"
  | "scoperta_salvata"
  | "scoperta_nel_planner"
  | "community_nel_planner"
  | "centro_suggerito"
  | "radar"
  | "impegno_manuale";

export const DEMAND_TYPE_LABEL: Record<DemandSignalType, string> = {
  partner_salvato: "Centro TRAMA salvato",
  partner_richiesta: "Richiesta a un centro TRAMA",
  scoperta_salvata: "Scoperta TRAMA salvata",
  scoperta_nel_planner: "Scoperta TRAMA nel Planner",
  community_nel_planner: "Scoperta community nel Planner",
  centro_suggerito: "Centro suggerito",
  radar: "Segnalato col Radar",
  impegno_manuale: "Impegno scritto a mano (testo libero)",
};

export interface DemandSignal {
  familyKey: string;
  /** Nome del centro/organizzatore o, per gli impegni a mano, luogo o titolo. */
  name: string;
  /** Comune del centro, se noto. */
  locality: string | null;
  type: DemandSignalType;
  at: string;
}

export interface DemandRow {
  key: string;
  label: string;
  locality: string | null;
  families: number;
  familyKeys: string[];
  signals: number;
  types: DemandSignalType[];
  /** Comuni della scuola delle famiglie che lo citano. */
  zones: string[];
  /** Fasce: 5 = ≥5 famiglie, 3 = ≥3, 2 = ≥2, 1 = una sola. */
  tier: 1 | 2 | 3 | 5;
  /** Solo testo libero: l'abbinamento va verificato a mano. */
  freeTextOnly: boolean;
}

/** Stessa regola di lib/data/center-leads.ts#normalizeDedupeKey (copiata qui perché quel modulo è server-only). */
export function normalizeDemandKey(name: string, locality?: string | null): string {
  const strip = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const namePart = strip(name);
  const localityPart = locality ? strip(locality) : "";
  return localityPart ? `${namePart}|${localityPart}` : namePart;
}

/** Parole troppo generiche per identificare un centro se scritte da sole in un impegno. */
const GENERIC_FREE_TEXT = new Set(["", "scuola", "casa", "nonni", "palestra", "piscina", "parco", "oratorio", "impegno", "attivita"]);

export function computeDemand(signals: DemandSignal[], zonesByFamily: Map<string, string[]>): DemandRow[] {
  // Per gli impegni a mano la località spesso manca: si aggrega sul solo nome.
  // Per gli altri si usa nome + comune; se un nome compare anche senza comune,
  // lo si aggancia alla variante con comune (stesso nome, una sola località).
  const keyed = signals
    .map((s) => {
      const nameKey = normalizeDemandKey(s.name);
      if (s.type === "impegno_manuale" && GENERIC_FREE_TEXT.has(nameKey)) return null;
      return { s, nameKey, fullKey: normalizeDemandKey(s.name, s.locality) };
    })
    .filter((x): x is { s: DemandSignal; nameKey: string; fullKey: string } => x !== null && x.nameKey.length > 1);

  const localitiesByName = new Map<string, Set<string>>();
  for (const k of keyed) {
    if (!k.s.locality) continue;
    const set = localitiesByName.get(k.nameKey) ?? new Set<string>();
    set.add(k.fullKey);
    localitiesByName.set(k.nameKey, set);
  }

  const groups = new Map<string, { label: string; labelFromFreeText: boolean; locality: string | null; items: DemandSignal[] }>();
  for (const k of keyed) {
    let key = k.fullKey;
    if (!k.s.locality) {
      const variants = localitiesByName.get(k.nameKey);
      if (variants && variants.size === 1) key = Array.from(variants)[0];
    }
    const freeText = k.s.type === "impegno_manuale";
    const g = groups.get(key) ?? { label: k.s.name.trim(), labelFromFreeText: freeText, locality: k.s.locality, items: [] };
    if (!g.locality && k.s.locality) g.locality = k.s.locality;
    // Il nome "ufficiale" (centro, scoperta) vince sul testo scritto a mano.
    if (g.labelFromFreeText && !freeText) {
      g.label = k.s.name.trim();
      g.labelFromFreeText = false;
    }
    g.items.push(k.s);
    groups.set(key, g);
  }

  const rows: DemandRow[] = [];
  for (const [key, g] of groups) {
    const familyKeys = Array.from(new Set(g.items.map((i) => i.familyKey)));
    const types = Array.from(new Set(g.items.map((i) => i.type)));
    const zones = Array.from(new Set(familyKeys.flatMap((f) => zonesByFamily.get(f) ?? []))).sort();
    const n = familyKeys.length;
    rows.push({
      key,
      label: g.label,
      locality: g.locality,
      families: n,
      familyKeys,
      signals: g.items.length,
      types,
      zones,
      tier: n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 1,
      freeTextOnly: types.every((t) => t === "impegno_manuale"),
    });
  }
  return rows.sort((a, b) => b.families - a.families || b.signals - a.signals || a.label.localeCompare(b.label, "it"));
}

/** "Top opportunità accerchiamento": almeno 2 famiglie distinte, non solo testo libero. */
export function topOpportunities(rows: DemandRow[], limit = 5): DemandRow[] {
  return rows.filter((r) => r.families >= 2 && !r.freeTextOnly).slice(0, limit);
}
