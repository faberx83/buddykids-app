"use server";

// TRAMA — LISTA D'ATTESA, lato Admin (20/10/2026): segnare una richiesta come
// invitata o archiviata. Client dell'utente: le RLS di migration_44 lasciano
// aggiornare solo l'Admin piattaforma.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { findAccountsByEmail, type WaitlistStatus } from "@/lib/data/waitlist";

// LOTTO 2 (16/11/2026). Richiesta di Fabrizio: "Non inventare una data di
// invio e non modificare i record storici."
//   - "Segna come inviato" è rifiutato se l'account esiste già: la data
//     sarebbe quella di oggi, non quella (sconosciuta) dell'invio reale.
//   - Archiviare non cancella più invited_at: prima lo azzerava, perdendo la
//     data dell'invio segnato. Solo "Rimetti tra le nuove" lo azzera (serve a
//     correggere un "inviato" premuto per errore).

export async function updateWaitlistStatusAction(id: string, status: WaitlistStatus): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!["nuovo", "invitato", "archiviato"].includes(status)) return { error: "Stato non valido" };
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  if (status === "invitato") {
    const { data: row } = await supabase.from("beta_waitlist").select("email").eq("id", id).maybeSingle();
    if (row?.email) {
      const accounts = await findAccountsByEmail(supabase, [row.email as string]);
      if (accounts.size > 0) {
        return { error: "Questa persona ha già un account: non segno un invio con la data di oggi. La richiesta resta nello storico come registrata." };
      }
    }
  }
  const patch: { status: WaitlistStatus; updated_at: string; invited_at?: string | null } = { status, updated_at: nowIso };
  if (status === "invitato") patch.invited_at = nowIso;
  if (status === "nuovo") patch.invited_at = null;
  const { data, error } = await supabase.from("beta_waitlist").update(patch).eq("id", id).select("id");
  if (error) return { error: "Non sono riuscito ad aggiornare la richiesta" };
  if (!data || data.length === 0) return { error: "Solo l'Admin piattaforma può farlo" };
  revalidatePath("/admin/lista-attesa");
  return {};
}
