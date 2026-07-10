"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/preferiti");
  return {};
}
