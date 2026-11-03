// TRAMA — FILTRI DI SCOPRI V2 (14/10/2026): scelte rapide e tipi del foglio
// dei filtri (components/nextgen/DiscoverFiltersSheet.tsx). File puro, testato
// in tests/one/scheda-v2.spec.ts.

import { dailyRateFor } from "@/lib/day-pricing";

export interface DiscoverFilterServices {
  preScuola: boolean;
  postScuola: boolean;
  pranzo: boolean;
  bar: boolean;
  attivitaExtra: boolean;
  accessoDisabili: boolean;
  dieteGestite: boolean;
}

export type DiscoverCoverageMode = "week_only" | "day_only" | "mixed";

export const AGE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "Tutte", min: 0, max: 18 },
  { label: "3–5 anni", min: 3, max: 5 },
  { label: "6–10 anni", min: 6, max: 10 },
  { label: "11–14 anni", min: 11, max: 14 },
];

export const PRICE_PRESETS: { label: string; value: number }[] = [
  { label: "Qualsiasi", value: 500 },
  { label: "Fino a €150", value: 150 },
  { label: "Fino a €250", value: 250 },
  { label: "Fino a €350", value: 350 },
];

export const SERVICE_OPTIONS: { key: keyof DiscoverFilterServices; icon: string; label: string }[] = [
  { key: "preScuola", icon: "ti-sunrise", label: "Pre-scuola" },
  { key: "postScuola", icon: "ti-sunset-2", label: "Post-scuola" },
  { key: "pranzo", icon: "ti-tools-kitchen-2", label: "Pranzo incluso" },
  { key: "bar", icon: "ti-cup", label: "Bar nel centro" },
  { key: "accessoDisabili", icon: "ti-wheelchair", label: "Accessibile" },
  { key: "dieteGestite", icon: "ti-salad", label: "Diete gestite" },
  { key: "attivitaExtra", icon: "ti-sparkles", label: "Attività extra" },
];


// ─────────────────────────────────────────────
// BUDGET IN SCOPRI: UNITÀ ESPLICITA (test browser 03/11/2026, Parent #1)
// ─────────────────────────────────────────────
// Prima: con "Giorni singoli" il budget restava "Prezzo a settimana" con
// soglie €150/250/350 mentre le card mostravano prezzi al giorno. Causa
// verificata: SearchDiscoveryClient confrontava sempre a.pricePerWeek con il
// tetto, qualunque fosse la copertura scelta; in più "Qualsiasi" (500) era un
// tetto vero e scartava le attività oltre €500 a settimana (es. €200 al
// giorno = €1000 per 5 giorni).
// Ora l'unità segue la copertura scelta:
//   - "Giorni singoli" (o "solo giorni spot") → budget AL GIORNO, confrontato
//     con il prezzo del giorno (lib/day-pricing.ts dailyRateFor, la stessa
//     regola delle card: lib/nextgen/activity-price.ts);
//   - "Settimana intera" → budget A SETTIMANA, sul prezzo della settimana;
//   - nessuna copertura o "Entrambe" → budget a settimana, dichiarato: per le
//     attività solo a giornate si conta una settimana di 5 giorni.
// "Qualsiasi" = nessun tetto. Prezzo mancante ("Prezzo da chiedere"): non
// viene escluso, perché non sappiamo che è fuori budget (stessa regola dei
// lead curati, isDiscoveryLeadCompatibleWithPriceCap); il foglio lo dice.

export const PRICE_ANY = 500;

export type PriceCapUnit = "day" | "week" | "mixed";

export const DAY_PRICE_PRESETS: { label: string; value: number }[] = [
  { label: "Qualsiasi", value: PRICE_ANY },
  { label: "Fino a €20", value: 20 },
  { label: "Fino a €30", value: 30 },
  { label: "Fino a €50", value: 50 },
];

export function priceCapUnit(coverageModes: DiscoverCoverageMode[], onlyDaySpots = false): PriceCapUnit {
  if (coverageModes.length === 1 && coverageModes[0] === "day_only") return "day";
  if (coverageModes.length === 0 && onlyDaySpots) return "day";
  if (coverageModes.length === 1 && coverageModes[0] === "week_only") return "week";
  return "mixed";
}

export function pricePresetsFor(unit: PriceCapUnit): { label: string; value: number }[] {
  return unit === "day" ? DAY_PRICE_PRESETS : PRICE_PRESETS;
}

export function priceCapTitle(unit: PriceCapUnit): string {
  return unit === "day" ? "Prezzo al giorno" : "Prezzo a settimana";
}

/** Riga di spiegazione sotto le soglie: dice cosa si confronta davvero. */
export function priceCapNote(unit: PriceCapUnit): string {
  const missing = "Le attività con prezzo da chiedere restano visibili.";
  if (unit === "day") return `Confrontiamo il prezzo di un giorno. ${missing}`;
  if (unit === "week") return `Confrontiamo il prezzo di una settimana. ${missing}`;
  return `Confrontiamo il prezzo di una settimana; per le attività a giornate contiamo 5 giorni. ${missing}`;
}

/** Etichetta corta del chip "Prezzo" in Scopri. */
export function priceCapChipLabel(cap: number, unit: PriceCapUnit): string {
  if (cap >= PRICE_ANY) return "Prezzo";
  return `Prezzo (≤€${cap}${unit === "day" ? "/giorno" : "/sett."})`;
}

/** Importo confrontato con il tetto; null = prezzo non indicato. */
export function priceComparedForCap(
  a: { pricePerWeek: number | null | undefined; bookingMode?: DiscoverCoverageMode | null },
  unit: PriceCapUnit
): number | null {
  const week = a.pricePerWeek;
  if (week === null || week === undefined || !Number.isFinite(week) || week < 0) return null;
  return unit === "day" ? dailyRateFor(week) : week;
}

export function matchesPriceCap(
  a: { pricePerWeek: number | null | undefined; bookingMode?: DiscoverCoverageMode | null },
  cap: number,
  unit: PriceCapUnit
): boolean {
  if (!(cap < PRICE_ANY)) return true;
  const compared = priceComparedForCap(a, unit);
  if (compared === null) return true;
  return compared <= cap;
}

/** Tetto equivalente a settimana per i lead curati (prezzi dichiarati a settimana). */
export function weeklyCapForLeads(cap: number, unit: PriceCapUnit): number {
  if (!(cap < PRICE_ANY)) return Number.POSITIVE_INFINITY;
  return unit === "day" ? cap * 5 : cap;
}
