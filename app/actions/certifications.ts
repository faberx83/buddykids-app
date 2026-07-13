"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Il gestore invia una richiesta di Certificazione servizio per una propria
// attività (etichetta libera + documento facoltativo già caricato sul bucket
// privato "buddykids-certifications", vedi lib/storage.ts). Resta sempre
// "pending": solo un Admin piattaforma può approvarla/rifiutarla (vedi
// reviewCertificationAction), le policy RLS lo impongono anche lato database.
export async function submitCertificationAction(
  activityDbId: string,
  label: string,
  documentPath?: string | null
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!label.trim()) return { error: "Inserisci un'etichetta per la certificazione" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: activityRow } = await supabase
    .from("activities")
    .select("center_id")
    .eq("id", activityDbId)
    .single();
  if (!activityRow?.center_id) return { error: "Attività non trovata" };

  const { error } = await supabase.from("activity_certifications").insert({
    activity_id: activityDbId,
    center_id: activityRow.center_id,
    label: label.trim(),
    document_url: documentPath || null,
    status: "pending",
    submitted_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/center/activities/${activityDbId}`);
  return {};
}

// Il gestore ritira una propria richiesta ancora in attesa (RLS: solo righe
// pending del proprio centro, o l'admin per qualunque riga).
export async function deleteCertificationAction(activityDbId: string, id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("activity_certifications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/center/activities/${activityDbId}`);
  return {};
}

// Solo un Admin piattaforma può approvare/rifiutare (le policy RLS lo
// impongono comunque: un gestore non-admin che tenta questa update ottiene
// un errore perché la sua unica policy di update richiede status='pending').
export async function reviewCertificationAction(
  id: string,
  approve: boolean,
  adminNote?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("activity_certifications")
    .update({
      status: approve ? "approved" : "rejected",
      admin_note: adminNote?.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/certifications");
  return {};
}

// Il bucket dei documenti è privato: per visualizzare/scaricare un
// documento già caricato serve un URL firmato temporaneo, generato lato
// server rispettando le stesse RLS di storage.objects (solo il centro
// proprietario o l'admin possono generarlo con successo).
export async function getCertificationDocumentUrlAction(path: string): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("buddykids-certifications")
    .createSignedUrl(path, 60 * 5);

  if (error || !data) return { error: error?.message || "Impossibile generare il link al documento" };
  return { url: data.signedUrl };
}
