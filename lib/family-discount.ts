// Sconto famiglia di default per prenotazioni con più bambini dello stesso
// nucleo familiare nella STESSA prenotazione: il primo bambino paga il
// prezzo pieno, dal secondo in poi si applica uno sconto crescente. Fasce di
// partenza, modificabili qui in un solo posto (indice 0 = primo bambino):
const DEFAULT_TIERS_PERCENT = [0, 10, 15, 20]; // 1°: pieno, 2°: -10%, 3°: -15%, 4°+: -20%

// Il gestore può personalizzare le fasce dal 2° figlio in poi (centers.
// family_discount_tiers, es. [10,15,20]) — il 1° figlio è sempre a prezzo
// pieno, quindi non va salvato/mostrato. Questa funzione ricostruisce
// l'array completo (con lo 0 iniziale) da usare nei calcoli.
export function buildFamilyTiers(overrideFrom2nd?: number[] | null): number[] {
  if (!overrideFrom2nd || overrideFrom2nd.length === 0) return DEFAULT_TIERS_PERCENT;
  return [0, ...overrideFrom2nd];
}

export function familyDiscountPercentForPosition(
  zeroBasedIndex: number,
  tiers: number[] = DEFAULT_TIERS_PERCENT
): number {
  return tiers[Math.min(zeroBasedIndex, tiers.length - 1)];
}

// `perChildAmount` = costo pieno di UN bambino (es. settimane × prezzo a
// settimana), PRIMA di qualsiasi sconto. Ritorna lo sconto totale (in euro)
// da sottrarre per tutti i bambini oltre al primo. `tiers` (opzionale) è
// l'array completo con lo 0 iniziale, es. da buildFamilyTiers().
export function familyDiscountAmount(
  perChildAmount: number,
  kidsCount: number,
  tiers: number[] = DEFAULT_TIERS_PERCENT
): number {
  let discount = 0;
  for (let i = 1; i < kidsCount; i++) {
    discount += perChildAmount * (familyDiscountPercentForPosition(i, tiers) / 100);
  }
  return Math.round(discount);
}

export const FAMILY_DISCOUNT_TIERS = DEFAULT_TIERS_PERCENT;
