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
      // Segnalazione di Fabrizio: il genitore deve accorgersi che è
      // arrivata una risposta ("un pallino, un pop-up") — read_by_parent
      // torna a false qui, il centro invece l'ha appena scritta quindi per
      // lui è già "letta".
      read_by_parent: false,
      read_by_center: true,
    })
    .eq("id", input.inquiryId);

  if (error) return { error: error.message };

  revalidatePath("/center/richieste");
  revalidatePath("/richieste");
  return {};
}

// Segna una o più richieste come lette/da leggere, da un lato o dall'altro
// (checkbox + "seleziona tutte" richiesti da Fabrizio su entrambi i lati).
// La RLS fa già rispettare i confini (un genitore aggiorna solo le proprie,
// un centro solo quelle delle proprie attività) — qui basta scegliere quale
// colonna toccare in base al lato.
export async function markInquiriesReadAction(input: {
  ids: string[];
  side: "parent" | "center";
  read: boolean;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.ids.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const column = input.side === "parent" ? "read_by_parent" : "read_by_center";
  const { error } = await supabase
    .from("activity_inquiries")
    .update({ [column]: input.read })
    .in("id", input.ids);

  if (error) return { error: error.message };

  revalidatePath(input.side === "parent" ? "/richieste" : "/center/richieste");
  return {};
}
