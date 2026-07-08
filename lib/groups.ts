// Logica pura (nessuna chiamata a Supabase) condivisa fra data layer, server
// actions e componenti — così le fasce di sconto restano in un unico posto
// e sono facili da cambiare in futuro.

// Sconto proporzionale alla dimensione del gruppo ("Richiesta Gruppo" verso
// il gestore). Fasce di partenza, modificabili qui in un solo posto:
//   3-4 bambini  → 0%  (sotto la soglia minima per far scattare uno sconto)
//   5-7 bambini  → 5%
//   8-11 bambini → 10%
//   12+ bambini  → 15%
export function discountForGroupSize(kidsCount: number): number {
  if (kidsCount >= 12) return 15;
  if (kidsCount >= 8) return 10;
  if (kidsCount >= 5) return 5;
  return 0;
}

export const GROUP_DISCOUNT_TIERS = [
  { minKids: 5, percent: 5 },
  { minKids: 8, percent: 10 },
  { minKids: 12, percent: 15 },
] as const;
