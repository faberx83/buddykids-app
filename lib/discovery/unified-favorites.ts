// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), §5 "PREFERITI VIEW".
//
// View-model di sola PRESENTAZIONE per "I tuoi preferiti" — UNICA lista con
// Partner e Scoperta TRAMA mescolati, stesso principio già validato in
// Unified Discovery (lib/discovery/result-model.ts): "domini separati,
// presentation layer unificato". Nessun I/O qui (pura, testabile senza
// Supabase) — l'assemblaggio con i dati reali vive in
// lib/data/favorites.ts#getUnifiedFavoritesForParent.

import type { Activity } from "@/lib/types";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
import type { CuratedFavoriteRecord } from "@/lib/data/curated-favorites";

export type UnifiedFavoriteItem =
  | { kind: "partner"; activity: Activity }
  | { kind: "curated"; curatedLeadId: string; lead: DiscoveryLeadRecord; createdAt: string };

/**
 * §4 "CURATED → FULL TRAMA TRANSITION": un curated_favorites con
 * promoted_to_activity_id valorizzato viene presentato come favorite
 * PARTNER (stessa card ActivityCardHorizontal, stessa grammatica visuale),
 * MAI più come Scoperta TRAMA — a RESOLUTION-TIME (qui, ad ogni lettura),
 * senza alcuna scrittura in "favorites": se l'attività promossa è già tra i
 * preferiti Partner dell'utente (stesso dbId), non viene duplicata; se non
 * lo è ancora, viene comunque mostrata come Partner (così il genitore non
 * perde il preferito e non deve ricliccare il cuore) SOLO se è stato
 * possibile risolvere l'Activity corrispondente (altrimenti — caso raro,
 * attività promossa poi disattivata — il curated_favorites resta silenzioso,
 * mai un errore visibile).
 *
 * §5 "Curated missing data": un curated_lead_id che non risolve più nel
 * dataset code-based (rimosso/rinominato) viene semplicemente OMESSO dalla
 * lista — mai una card rotta/vuota, mai un crash.
 */
export function buildUnifiedFavorites(
  partnerActivities: Activity[],
  curatedFavorites: CuratedFavoriteRecord[],
  promotedActivitiesById: Map<string, Activity>
): UnifiedFavoriteItem[] {
  const partnerDbIds = new Set(partnerActivities.map((a) => a.dbId).filter(Boolean) as string[]);
  const items: UnifiedFavoriteItem[] = partnerActivities.map((activity) => ({ kind: "partner", activity }));

  for (const cf of curatedFavorites) {
    if (cf.promotedToActivityId) {
      if (partnerDbIds.has(cf.promotedToActivityId)) continue; // già presente come Partner, nessun duplicato
      const promoted = promotedActivitiesById.get(cf.promotedToActivityId);
      if (promoted) {
        items.push({ kind: "partner", activity: promoted });
        partnerDbIds.add(cf.promotedToActivityId);
      }
      // Se l'attività promossa non risolve (es. disattivata nel frattempo),
      // resta silenzioso: nessuna card Curated fittizia, nessun errore.
      continue;
    }
    if (!cf.lead) continue; // dato mancante — vedi doc sopra
    items.push({ kind: "curated", curatedLeadId: cf.curatedLeadId, lead: cf.lead, createdAt: cf.createdAt });
  }

  return items;
}
