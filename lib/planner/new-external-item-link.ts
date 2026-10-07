// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Link unico per "aggiungi un
// impegno" da fuori dal Planner (Scopri senza risultati, Home): apre il
// Planner con il modulo degli impegni esterni già aperto
// (ExternalPlannerItemsSection legge il parametro al mount).
export const NEW_EXTERNAL_ITEM_PARAM = "nuovo";
export const NEW_EXTERNAL_ITEM_VALUE = "impegno";
export const NEW_EXTERNAL_ITEM_HREF = `/nextgen/planner?${NEW_EXTERNAL_ITEM_PARAM}=${NEW_EXTERNAL_ITEM_VALUE}#impegni`;

export function wantsNewExternalItem(search: string): boolean {
  try {
    return new URLSearchParams(search).get(NEW_EXTERNAL_ITEM_PARAM) === NEW_EXTERNAL_ITEM_VALUE;
  } catch {
    return false;
  }
}
