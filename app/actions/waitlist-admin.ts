"use server";

// TRAMA — LISTA D'ATTESA, lato Admin (20/10/2026): segnare una richiesta come
// invitata o archiviata. Client dell'utente: le RLS di migration_44 lasciano
// aggiornare solo l'Admin piattaforma.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { WaitlistStatus } from "@/lib/data/waitlist";

export async function updateWaitlistStatusAction(id: string, status: WaitlistStatus): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!["nuovo", "invitato", "archiviato"].includes(status)) return { error: "Stato non valido" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_waitlist")
    .update({ status, invited_at: status === "invitato" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Non sono riuscito ad aggiornare la richiesta" };
  if (!data || data.length === 0) return { error: "Solo l'Admin piattaforma può farlo" };
  revalidatePath("/admin/lista-attesa");
  return {};
}
