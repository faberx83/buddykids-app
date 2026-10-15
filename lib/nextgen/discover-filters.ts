// TRAMA — FILTRI DI SCOPRI V2 (14/10/2026): scelte rapide e tipi del foglio
// dei filtri (components/nextgen/DiscoverFiltersSheet.tsx). File puro, testato
// in tests/one/scheda-v2.spec.ts.

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

