"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
// Push notifications (31/08/2026, estensione trigger P0) — segnalato da
// Fabrizio dopo un test reale ("ho mandato una richiesta... ma nessuna
// notifica push"): inquiry_reply/center_inquiry_new erano stati lasciati
// deliberatamente fuori dal primo giro P0 (vedi
// TRAMA_PILOT_NOTIFICATIONS_IMPLEMENTATION.md, "Deliberatamente NON
// agganciati"), ma "Contatta il gestore" è di fatto un flusso ACTION a tutti
// gli effetti (una domanda che aspetta una risposta, una risposta che il
// genitore deve vedere) quanto i 4 già cablati. Stesso principio best-effort
// (sendPushToUser non lancia mai, un fallimento push non deve mai far
// fallire la creazione/risposta della richiesta già salvata).
import { sendPushToUser } from "@/lib/push/send";

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

  // Push al centro — a TUTTI gli admin di quell'attività (stesso principio
  // "notifica chi può agire" già usato per gli altri trigger P0).
  //
  // Bug trovato da Fabrizio con un test reale (01/09/2026, "gen --> centro
  // nessuna notifica"): la lookup "profiles con center_id=X e
  // role=center_admin" qui sotto usava il client NORMALE (sessione del
  // genitore che ha appena scritto la richiesta) — ma la RLS su profiles
  // permette a un utente di vedere SOLO il proprio profilo (più il caso
  // inverso "il centro vede i genitori delle proprie prenotazioni", vedi
  // migration/schema), MAI il contrario. La query tornava quindi SEMPRE []
  // per un genitore, senza alcun errore (RLS filtra silenziosamente, non
  // lancia un'eccezione) — sendPushToUser non veniva mai chiamata. Stesso
  // motivo per cui lib/push/send.ts usa già createServiceClient() per
  // leggere le subscription di UN UTENTE DIVERSO dal chiamante: qui serve
  // lo stesso client per lo stesso identico motivo (leggere profili di
  // ALTRI utenti, non il proprio).
  try {
    const { data: activityRow } = await supabase
      .from("activities")
      .select("name, center_id")
      .eq("id", input.activityDbId)
      .maybeSingle();
    if (activityRow?.center_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const service = createServiceClient();
      const { data: centerAdmins } = service
        ? await service
            .from("profiles")
            .select("id")
            .eq("center_id", activityRow.center_id)
            .eq("role", "center_admin")
        : { data: null };
      await Promise.all(
        (centerAdmins ?? []).map((admin) =>
          sendPushToUser(admin.id, {
            title: "Nuova richiesta",
            body: `${profile?.full_name || "Un genitore"} ha scritto per ${activityRow.name ?? "un'attività"}.`,
            deepLink: "/center/richieste",
          })
        )
      );
    }
  } catch (e) {
    console.error("[createInquiryAction] Errore inatteso durante la push al centro:", e);
  }

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

  // Push al genitore — stesso principio best-effort del resto del file.
  try {
    const { data: row } = await supabase
      .from("activity_inquiries")
      .select("parent_id, activities ( name )")
      .eq("id", input.inquiryId)
      .maybeSingle();
    if (row?.parent_id) {
      const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
      await sendPushToUser(row.parent_id, {
        title: `Il centro ha risposto: ${activity?.name ?? "la tua richiesta"}`,
        body: input.reply.trim(),
        deepLink: "/richieste",
      });
    }
  } catch (e) {
    console.error("[replyToInquiryAction] Errore inatteso durante la push al genitore:", e);
  }

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
