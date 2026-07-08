// Sconto famiglia di default per prenotazioni con più bambini dello stesso
// nucleo familiare nella STESSA prenotazione: il primo bambino paga il
// prezzo pieno, dal secondo in poi si applica uno sconto crescente. Fasce di
// partenza, modificabili qui in un solo posto (indice 0 = primo bambino):
const TIERS_PERCENT = [0, 10, 15, 20]; // 1°: pieno, 2°: -10%, 3°: -15%, 4°+: -20%

export function familyDiscountPercentForPosition(zeroBasedIndex: number): number {
  return TIERS_PERCENT[Math.min(zeroBasedIndex, TIERS_PERCENT.length - 1)];
}

// `perChildAmount` = costo pieno di UN bambino (es. settimane × prezzo a
// settimana), PRIMA di qualsiasi sconto. Ritorna lo sconto totale (in euro)
// da sottrarre per tutti i bambini oltre al primo.
export function familyDiscountAmount(perChildAmount: number, kidsCount: number): number {
  let discount = 0;
  for (let i = 1; i < kidsCount; i++) {
    discount += perChildAmount * (familyDiscountPercentForPosition(i) / 100);
  }
  return Math.round(discount);
}

export const FAMILY_DISCOUNT_TIERS = TIERS_PERCENT;
