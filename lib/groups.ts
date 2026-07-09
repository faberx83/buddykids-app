// Logica pura (nessuna chiamata a Supabase) condivisa fra data layer, server
// actions e componenti — così le fasce di sconto restano in un unico posto
// e sono facili da cambiare in futuro.

export interface GroupDiscountTier {
  minKids: number;
  percent: number;
}

// Sconto proporzionale alla dimensione del gruppo ("Richiesta Gruppo" verso
// il gestore). Fasce di default, modificabili qui in un solo posto — il
// gestore può però personalizzarle per il proprio centro (centers.
// group_discount_tiers): 3-4 bambini restano sempre sotto la soglia minima
// (0%, non configurabile) e non sono incluse nell'array.
export const GROUP_DISCOUNT_TIERS: GroupDiscountTier[] = [
  { minKids: 5, percent: 5 },
  { minKids: 8, percent: 10 },
  { minKids: 12, percent: 15 },
];

export function discountForGroupSize(
  kidsCount: number,
  tiers: GroupDiscountTier[] = GROUP_DISCOUNT_TIERS
): number {
  const sorted = [...tiers].sort((a, b) => b.minKids - a.minKids);
  for (const tier of sorted) {
    if (kidsCount >= tier.minKids) return tier.percent;
  }
  return 0;
}
