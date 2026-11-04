// TRAMA — IMPORTI DI UNA PRENOTAZIONE, UNA REGOLA SOLA (QA in produzione
// 04/11/2026, EXTRA-01 HIGH: la stessa prenotazione era €57 nel portale
// centri e €54 per la famiglia).
//
// Causa verificata: bookings.total_amount è l'importo DOVUTO, già scontato e
// con i servizi (app/booking/[id]/BookingClient.tsx: total = subtotal −
// sconti + servizi; lo stesso in app/actions/bookings.ts quando si modifica);
// bookings.discount_amount è solo il dettaglio degli sconti già tolti. Il
// portale centri mostrava total_amount (€57, giusto); le Prenotazioni della
// famiglia (V2 e di prima) e la riga "€… di prenotazioni confermate" facevano
// total_amount − discount_amount, togliendo lo sconto una seconda volta
// (57 − 3 = €54) e mostrando barrato €57 come prezzo pieno. I dati in
// produzione sono coerenti (verificato in sola lettura: per tutte le
// prenotazioni a giorni attive total + sconto = somma dei giorni × bambini).
// Corretto solo il modo di leggerli, niente da riconciliare.
//
// In più (stessa logica): annullando un giorno, cancelBookingDayAction
// toglieva il prezzo di UN bambino e lasciava lo sconto com'era. Ora si
// ricalcola sui giorni rimasti con la stessa regola della prenotazione.
// Test: tests/one/qa-prod-0411.spec.ts.

import { familyDiscountAmount } from "@/lib/family-discount";

export interface StoredAmounts {
  /** bookings.total_amount: dovuto, già scontato. */
  totalAmount: number;
  /** bookings.discount_amount: sconti già tolti (solo dettaglio). */
  discountAmount: number;
}

/** Quanto paga la famiglia: è total_amount, senza togliere altro. */
export function amountDue(b: Pick<StoredAmounts, "totalAmount">): number {
  return Number(b.totalAmount) || 0;
}

/** Prezzo prima degli sconti, per il barrato: dovuto + sconti. */
export function amountBeforeDiscount(b: StoredAmounts): number {
  return (Number(b.totalAmount) || 0) + (Number(b.discountAmount) || 0);
}

/**
 * Totali di una prenotazione a giorni: somma dei giorni (per bambino) ×
 * bambini, meno lo sconto fratelli (lib/family-discount.ts). Stessa formula
 * di BookingClient e di updateBookingDaysAction.
 */
export function dayBookingTotals(
  dayPrices: number[],
  kidsCount: number,
  familyTiers: number[]
): { subtotal: number; familyDiscount: number; total: number } {
  const kids = Math.max(1, Math.floor(kidsCount || 1));
  const perChild = dayPrices.reduce((s, p) => s + (Number(p) || 0), 0);
  const subtotal = perChild * kids;
  const familyDiscount = familyDiscountAmount(perChild, kids, familyTiers);
  return { subtotal, familyDiscount, total: Math.max(0, subtotal - familyDiscount) };
}

/**
 * Importi dopo l'annullamento di uno o più giorni. Lo sconto fratelli si
 * ricalcola sui giorni rimasti; un eventuale altro sconto già presente (per
 * esempio l'invito) resta, in proporzione al nuovo subtotale.
 */
export function amountsAfterDayRemoval(input: {
  previous: StoredAmounts;
  previousDayPrices: number[];
  remainingDayPrices: number[];
  kidsCount: number;
  familyTiers: number[];
}): StoredAmounts {
  const before = dayBookingTotals(input.previousDayPrices, input.kidsCount, input.familyTiers);
  const after = dayBookingTotals(input.remainingDayPrices, input.kidsCount, input.familyTiers);
  const otherDiscount = Math.max(0, (Number(input.previous.discountAmount) || 0) - before.familyDiscount);
  const otherAfter = before.subtotal > 0 ? Math.round((otherDiscount * after.subtotal) / before.subtotal) : 0;
  const discountAmount = after.familyDiscount + otherAfter;
  return { totalAmount: Math.max(0, after.subtotal - discountAmount), discountAmount };
}
