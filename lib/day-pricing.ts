// TRAMA ONE Build Sprint 3 — calcolo prezzo per prenotazione "Giorni spot"
// (selezione di singoli giorni invece dell'intera settimana). Funzioni pure,
// nessuna dipendenza da Supabase/schema: usate sia lato client
// (DetailClient/BookingClient, per mostrare il totale mentre il genitore
// sceglie) sia potenzialmente lato server per un ricalcolo di verifica.
//
// Regola di base concordata implicitamente dal modello dati esistente
// (nessun "prezzo al giorno" esplicito in Activity — solo pricePerWeek):
// la tariffa giornaliera di riferimento è pricePerWeek / 5 (5 giorni feriali
// per settimana, coerente con weekdayLabels/schedule già usati altrove in
// DetailClient.tsx). Ogni DayAvailability puo' poi avere il proprio
// discountPercent (es. "Giornata in piscina" scontata) che si applica SOLO
// su quel giorno, sopra la tariffa base.
import { DayAvailability } from "@/lib/types";

/** Tariffa base di un giorno, prima di eventuali sconti specifici del giorno. */
export function dailyRateFor(pricePerWeek: number): number {
  return pricePerWeek / 5;
}

/** Prezzo di un singolo giorno, sconto del giorno incluso (arrotondato ai centesimi). */
export function dayPrice(day: DayAvailability, pricePerWeek: number): number {
  const base = dailyRateFor(pricePerWeek);
  const discount = day.discountPercent ?? 0;
  return Math.round(base * (1 - discount / 100) * 100) / 100;
}

/**
 * Costo totale per un set di giorni selezionati (un bambino) — somma dei
 * prezzi giorno-per-giorno, ciascuno con il proprio sconto se presente.
 * `selectedDates` è l'insieme delle date (yyyy-mm-dd) scelte dal genitore.
 */
export function calculateDayBookingCost(
  days: DayAvailability[],
  selectedDates: string[],
  pricePerWeek: number
): number {
  const selected = new Set(selectedDates);
  const total = days
    .filter((d) => selected.has(d.date))
    .reduce((sum, d) => sum + dayPrice(d, pricePerWeek), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Vero se il numero di giorni scelti rispetta activity.minDaysPerBooking
 * (quando il Gestore non ne ha impostato uno, qualunque numero > 0 va bene).
 */
export function meetsMinDaysRequirement(
  selectedCount: number,
  minDaysPerBooking?: number
): boolean {
  if (selectedCount === 0) return false;
  if (!minDaysPerBooking || minDaysPerBooking <= 1) return true;
  return selectedCount >= minDaysPerBooking;
}
