"use server";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), CURATED FAVORITES.
//
// Speculare a app/actions/favorites.ts#toggleFavoriteAction, sulla tabella
// nuova public.curated_favorites (supabase/migration_38_curated_favorites_
// and_announcements.sql — NON ANCORA APPLICATA, vedi commento in quel file).
// "next" è lo stato DESIDERATO dopo il click, calcolato lato client per un
// aggiornamento ottimistico immediato — stesso identico contratto
// dell'azione Partner, cosi i componenti UI (DiscoveryLeadCard,
// DiscoveryMapPopupCard) possono seguire lo stesso pattern optimistic-UI +
// rollback già in uso da ActivityCard.tsx.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";

export async function toggleCuratedFavoriteAction(
  curatedLeadId: string,
  next: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  if (next) {
    const { error } = await supabase
      .from("curated_favorites")
      .upsert({ parent_id: user.id, curated_lead_id: curatedLeadId }, { onConflict: "parent_id,curated_lead_id" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("curated_favorites")
      .delete()
      .eq("parent_id", user.id)
      .eq("curated_lead_id", curatedLeadId);
    if (error) return { error: error.message };
  }

  try {
    await persistProductEvent(
      {
        event: next ? "favorite_added" : "favorite_removed",
        correlationId: generateCorrelationId(),
        detail: `curated:${curatedLeadId}`,
      },
      { supabase, userId: user.id }
    );
  } catch {
    // silenzioso, per costruzione — vedi app/actions/favorites.ts.
  }

  // Stesse due rotte "Preferiti" già gestite da toggleFavoriteAction (bugfix
  // 05/09/2026 in app/actions/favorites.ts) — nessuna terza rotta introdotta
  // da questo lavoro, entrambe leggono lo stesso getUnifiedFavoritesForParent().
  revalidatePath("/preferiti");
  revalidatePath("/nextgen/preferiti");
  // La card Curated compare anche in Scopri/Ricerca (DiscoveryLeadCard,
  // DiscoveryMapPopupCard) — stessa esigenza di invalidazione già risolta
  // per il preferito Partner in quella pagina (SearchDiscoveryClient).
  revalidatePath("/nextgen/search");

  return {};
}
