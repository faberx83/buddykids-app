// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Link unico per "aggiungi un
// impegno" da fuori dal Planner (Scopri senza risultati, Home): apre il
// Planner con il modulo degli impegni esterni già aperto
// (ExternalPlannerItemsSection legge il parametro al mount).
export const NEW_EXTERNAL_ITEM_PARAM = "nuovo";
export const NEW_EXTERNAL_ITEM_VALUE = "impegno";
export const NEW_EXTERNAL_ITEM_HREF = `/nextgen/planner?${NEW_EXTERNAL_ITEM_PARAM}=${NEW_EXTERNAL_ITEM_VALUE}#impegni`;

/**
 * 15/10/2026 (Fabrizio: "se sono nella settimana X e clicco aggiungi impegno
 * deve essere contestualizzato a quella settimana"): stesso link, con la
 * settimana del Planner quando è nota.
 */
export function newExternalItemHref(weekMondayIso?: string | null): string {
  if (!weekMondayIso || !/^\d{4}-\d{2}-\d{2}$/.test(weekMondayIso)) return NEW_EXTERNAL_ITEM_HREF;
  return `/nextgen/planner?week=${weekMondayIso}&${NEW_EXTERNAL_ITEM_PARAM}=${NEW_EXTERNAL_ITEM_VALUE}#impegni`;
}

/** Data proposta per un nuovo impegno nella settimana che inizia di lunedì: oggi se è dentro, altrimenti il lunedì. */
export function defaultDateForWeek(weekMondayIso: string, todayIso: string): string {
  const monday = new Date(weekMondayIso + "T00:00:00Z");
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const sundayIso = sunday.toISOString().slice(0, 10);
  return todayIso >= weekMondayIso && todayIso <= sundayIso ? todayIso : weekMondayIso;
}

export function wantsNewExternalItem(search: string): boolean {
  try {
    return new URLSearchParams(search).get(NEW_EXTERNAL_ITEM_PARAM) === NEW_EXTERNAL_ITEM_VALUE;
  } catch {
    return false;
  }
}
