"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Crea una richiesta del genitore verso il centro ("Contatta il gestore"
// nella scheda attività) — ticketing semplice, vedi lib/data/inquiries.ts.
export async function createInquiryAction(input: {
  activityDbId: string;
  message: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.message.trim()) return { error: "Scrivi un messaggio prima di inviare" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("activity_inquiries").insert({
    activity_id: input.activityDbId,
    parent_id: user.id,
    message: input.message.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath("/richieste");
  return {};
}

// Risposta del Gestore a una richiesta ricevuta — un solo giro (nessuna
// chat multi-messaggio, vedi commento su activity_inquiries in schema.sql).
export async function replyToInquiryAction(input: {
  inquiryId: string;
  reply: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.reply.trim()) return { error: "Scrivi una risposta prima di inviare" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("activity_inquiries")
    .update({
      reply: input.reply.trim(),
      replied_by: user.id,
      replied_at: new Date().toISOString(),
      status: "risposta",
    })
    .eq("id", input.inquiryId);

  if (error) return { error: error.message };

  revalidatePath("/center/richieste");
  return {};
}
