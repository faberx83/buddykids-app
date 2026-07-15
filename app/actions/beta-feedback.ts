"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// SPRINT 5 (NEXTGEN) — "Segnala un problema": il genitore invia una
// segnalazione dalla floating CTA (BetaFeedbackButton.tsx), sempre con
// app_source="genitori" (colonna già pronta per "gestore", quando lo stesso
// meccanismo verrà aggiunto a quell'app — Fabrizio: "su cui poi
// implementeremo stesso meccanismo"), sempre in stato "nuovo" (RLS lo
// impone comunque). "area"/"pagePath" arrivano già calcolati dal client
// (vedi lib/nextgen/beta-feedback-areas.ts), nessuna logica di
// interpretazione lato server.
export async function submitBetaFeedbackAction(
  area: string,
  pagePath: string,
  message: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!message.trim()) return { error: "Scrivi qualcosa prima di inviare" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("beta_feedback").insert({
    parent_id: user.id,
    app_source: "genitori",
    area,
    page_path: pagePath,
    message: message.trim(),
    status: "nuovo",
  });

  if (error) return { error: error.message };
  revalidatePath("/nextgen/profile/segnalazioni");
  revalidatePath("/admin/segnalazioni-beta");
  return {};
}

// Solo un Admin piattaforma può cambiare stato/nota (le policy RLS lo
// impongono comunque: l'unica policy di update su beta_feedback richiede
// is_platform_admin()).
export async function updateBetaFeedbackStatusAction(
  id: string,
  status: "nuovo" | "in_gestione" | "risolto",
  adminNote?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("beta_feedback")
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/segnalazioni-beta");
  return {};
}
