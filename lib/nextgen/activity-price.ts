// TRAMA — PREZZO DI UN'ATTIVITÀ, UNA REGOLA SOLA (03/11/2026, report
// Parent/Partner del 30/10, UX-CROSS-001 "prezzo della card non
// rappresentativo"): l'attività demo solo a giornate aveva in Scopri
// "€150 a settimana", mentre dettaglio, richiesta e portale centri dicevano
// "€30 al giorno". Il modello ha un solo prezzo (price_per_week) e il giorno
// vale un quinto (lib/day-pricing.ts, dailyRateFor): card, dettaglio e
// riepilogo usano questa regola, secondo la modalità dell'attività.
//   - solo giorni → "€30 al giorno";
//   - solo settimane (o modalità non indicata) → "€150 a settimana";
//   - mista → "€150 a settimana", con "o €30 al giorno";
//   - zero → "€0" (senza costo) e prezzo mancante → "Prezzo da chiedere": mai confusi.
// Test: tests/one/report-parent-3010.spec.ts.

import { dailyRateFor } from "@/lib/day-pricing";

export interface ActivityPrice {
  /** null = prezzo non indicato. */
  amount: number | null;
  unit: "al giorno" | "a settimana" | null;
  /** Abbreviato per le card piccole: "/giorno", "/sett.". */
  short: string;
  /** Per le attività miste: il prezzo del giorno. */
  alt: { amount: number; unit: "al giorno" } | null;
  /** Testo intero: "€30 al giorno", "€150 a settimana · o €30 al giorno", "Prezzo da chiedere". */
  label: string;
}

const eur = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;

export function activityPrice(a: { pricePerWeek: number | null | undefined; bookingMode?: "week_only" | "day_only" | "mixed" | null }): ActivityPrice {
  const week = a.pricePerWeek;
  if (week === null || week === undefined || !Number.isFinite(week) || week < 0) {
    return { amount: null, unit: null, short: "", alt: null, label: "Prezzo da chiedere" };
  }
  if (a.bookingMode === "day_only") {
    const day = dailyRateFor(week);
    return { amount: day, unit: "al giorno", short: "/giorno", alt: null, label: `${eur(day)} al giorno` };
  }
  if (a.bookingMode === "mixed") {
    const day = dailyRateFor(week);
    return {
      amount: week,
      unit: "a settimana",
      short: "/sett.",
      alt: { amount: day, unit: "al giorno" },
      label: `${eur(week)} a settimana · o ${eur(day)} al giorno`,
    };
  }
  return { amount: week, unit: "a settimana", short: "/sett.", alt: null, label: `${eur(week)} a settimana` };
}

export const formatEuro = eur;
