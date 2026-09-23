"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), §7 "FAVORITES
// ANALYTICS": favorite_added/favorite_removed non erano mai stati
// istrumentati (vedi STATE_OF_THE_ART.md) — stesso pattern best-effort
// mai-bloccante già in uso in app/actions/discovery.ts, `detail` =
// "partner:<activityDbId>" (mai un dato di bambino/famiglia).
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";

// Preferiti — salva/rimuove un'attività dal cuore nella scheda attività.
// "next" è lo stato DESIDERATO dopo il click (true = aggiungi, false =
// rimuovi), calcolato lato client per un aggiornamento ottimistico immediato.
export async function toggleFavoriteAction(
  activityDbId: string,
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
      .from("favorites")
      .upsert({ parent_id: user.id, activity_id: activityDbId }, { onConflict: "parent_id,activity_id" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("parent_id", user.id)
      .eq("activity_id", activityDbId);
    if (error) return { error: error.message };
  }

  // Best-effort, mai bloccante — un fallimento qui non deve mai impedire il
  // toggle già riuscito sopra (stesso principio di logDiscoveryLeadEventAction).
  try {
    await persistProductEvent(
      { event: next ? "favorite_added" : "favorite_removed", correlationId: generateCorrelationId(), detail: `partner:${activityDbId}` },
      { supabase, userId: user.id }
    );
  } catch {
    // silenzioso, per costruzione: la telemetria non deve mai far fallire un'azione utente reale.
  }

  // FIX (segnalazione Fabrizio 05/09/2026, "la selezione di un 'preferito'
  // non rimane e non viene vista tra i miei preferiti"): esiste una SECONDA
  // pagina "Preferiti" per NEXTGEN (app/nextgen/preferiti/page.tsx — stesso
  // identico dato, getFavoriteActivitiesForParent(), stesso componente
  // PreferitiView), ma solo /preferiti (legacy) veniva invalidata qui —
  // dopo un toggle, /nextgen/preferiti poteva continuare a mostrare la
  // cache precedente (senza il preferito appena aggiunto) finché non
  // scadeva da sola. Stesso principio già applicato altrove in questo
  // codice quando un dato è letto da più rotte (es. revalidatePath multipli
  // in app/actions/attendance.ts).
  revalidatePath("/preferiti");
  revalidatePath("/nextgen/preferiti");
  return {};
}
