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
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { findOpenInquiryForActivity } from "@/lib/data/inquiries";
import { emailCenterAdminsOfNewMessage } from "@/lib/centers/notify-center";
import {
  INQUIRY_THREADS_FLAG,
  cleanMessageBody,
  headerAfterMessage,
  isMissingRelationError,
  type InquirySide,
} from "@/lib/inquiries/thread";

// TRAMA — MESSAGGI CON IL CENTRO COME CONVERSAZIONE (27/10/2026,
// migration_54; approvato il 15/10, richiamato da Fabrizio il 27/10: "un
// botta e risposta e non n messaggi diversi"). activity_inquiries resta la
// conversazione; ogni messaggio va in inquiry_messages. Regole:
// - i messaggi si scrivono SEMPRE anche in inquiry_messages (se la tabella
//   c'è), così la storia è completa qualunque sia il flag;
// - con INQUIRY_THREADS_ENABLED "Contatta il gestore" riprende la
//   conversazione aperta su quell'attività invece di aprirne un'altra, e le
//   pagine mostrano la conversazione; spento = ticket come prima;
// - la riga di activity_inquiries continua a dire stato, letto/non letto e
//   ultima risposta (reply), per Admin SLA, cruscotto, badge e notifiche.

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function threadsEnabled(userId: string, role: string | null): Promise<boolean> {
  return resolveFeatureFlag({ flagName: INQUIRY_THREADS_FLAG, userId, role }).catch(() => false);
}

// Un messaggio nella tabella dei messaggi + ultimo messaggio sulla
// conversazione. Best-effort: senza migration_54 non fa nulla.
async function appendMessage(
  supabase: SupabaseLike,
  inquiryId: string,
  authorId: string,
  side: InquirySide,
  body: string,
  at: string
): Promise<{ stored: boolean; error?: string }> {
  const { error } = await supabase
    .from("inquiry_messages")
    .insert({ inquiry_id: inquiryId, author_id: authorId, author_side: side, body, created_at: at });
  if (error) {
    if (isMissingRelationError(error)) return { stored: false };
    return { stored: false, error: error.message };
  }
  // colonna di migration_54: aggiornata a parte, un errore qui non conta
  await supabase.from("activity_inquiries").update({ last_message_at: at }).eq("id", inquiryId);
  return { stored: true };
}

// Push (e, col percorso del pilota, email) ai gestori del centro per un
// messaggio della famiglia. Mai blocca il messaggio già salvato.
async function notifyCenterOfParentMessage(
  supabase: SupabaseLike,
  userId: string,
  activityDbId: string,
  inquiryId: string,
  body: string,
  isFirst: boolean,
  threads: boolean
) {
  // Bug trovato da Fabrizio con un test reale (01/09/2026, "gen --> centro
  // nessuna notifica"): la lookup dei gestori va fatta col client di
  // servizio — la RLS su profiles fa vedere a un genitore solo il proprio
  // profilo, la query tornava sempre [] senza errore.
  try {
    const { data: activityRow } = await supabase
      .from("activities")
      .select("name, center_id")
      .eq("id", activityDbId)
      .maybeSingle();
    if (!activityRow?.center_id) return;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const service = createServiceClient();
    const { data: centerAdmins } = service
      ? await service.from("profiles").select("id").eq("center_id", activityRow.center_id).eq("role", "center_admin")
      : { data: null };
    await Promise.all(
      (centerAdmins ?? []).map((admin) =>
        sendPushToUser(admin.id, {
          title: isFirst ? "Nuova richiesta" : "Nuovo messaggio",
          body: `${profile?.full_name || "Un genitore"} ha scritto per ${activityRow.name ?? "un'attività"}.`,
          deepLink: threads ? `/center/richieste/${inquiryId}` : "/center/richieste",
        })
      )
    );
    await emailCenterAdminsOfNewMessage({
      centerId: activityRow.center_id,
      activityName: activityRow.name ?? null,
      parentFirstName: profile?.full_name ? profile.full_name.split(" ")[0] : null,
      preview: body,
      inquiryId,
    });
  } catch (e) {
    console.error("[inquiries] Errore inatteso durante l'avviso al centro:", e);
  }
}

// "Contatta il gestore" nella scheda attività (o dalle prenotazioni).
// Con la conversazione accesa riprende quella aperta su questa attività.
export async function createInquiryAction(input: {
  activityDbId: string;
  message: string;
}): Promise<{ error?: string; inquiryId?: string; continued?: boolean }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const clean = cleanMessageBody(input.message);
  if (!clean.ok) return { error: clean.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const threads = await threadsEnabled(user.id, "parent");
  const at = new Date().toISOString();

  if (threads) {
    const existing = await findOpenInquiryForActivity(supabase, user.id, input.activityDbId);
    if (existing) {
      const res = await sendParentMessage(supabase, user.id, existing, clean.body, at);
      if (res.error) return { error: res.error };
      await notifyCenterOfParentMessage(supabase, user.id, input.activityDbId, existing, clean.body, false, true);
      revalidatePath("/nextgen/richieste");
      return { inquiryId: existing, continued: true };
    }
  }

  const { data: created, error } = await supabase
    .from("activity_inquiries")
    .insert({
      activity_id: input.activityDbId,
      parent_id: user.id,
      message: clean.body,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message || "Errore nell'invio del messaggio" };

  // primo messaggio anche nella conversazione (se la tabella c'è)
  await appendMessage(supabase, created.id as string, user.id, "parent", clean.body, at);

  revalidatePath("/richieste");
  revalidatePath("/nextgen/richieste");
  await notifyCenterOfParentMessage(supabase, user.id, input.activityDbId, created.id as string, clean.body, true, threads);
  return { inquiryId: created.id as string };
}

async function sendParentMessage(
  supabase: SupabaseLike,
  userId: string,
  inquiryId: string,
  body: string,
  at: string
): Promise<{ error?: string }> {
  const stored = await appendMessage(supabase, inquiryId, userId, "parent", body, at);
  if (stored.error) return { error: stored.error };
  if (!stored.stored) return { error: "La conversazione non è ancora disponibile: riprova più tardi." };
  // last_message_at l'ha già scritto appendMessage
  const { last_message_at: _at, ...header } = headerAfterMessage("parent", body, at);
  void _at;
  const { error } = await supabase.from("activity_inquiries").update(header).eq("id", inquiryId);
  if (error) return { error: error.message };
  return {};
}

// La famiglia scrive ancora nella stessa conversazione.
export async function sendInquiryMessageAction(input: {
  inquiryId: string;
  message: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const clean = cleanMessageBody(input.message);
  if (!clean.ok) return { error: clean.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: row } = await supabase
    .from("activity_inquiries")
    .select("id, activity_id, parent_id")
    .eq("id", input.inquiryId)
    .maybeSingle();
  if (!row || row.parent_id !== user.id) return { error: "Conversazione non trovata" };

  const at = new Date().toISOString();
  const res = await sendParentMessage(supabase, user.id, input.inquiryId, clean.body, at);
  if (res.error) return res;

  revalidatePath("/nextgen/richieste");
  revalidatePath(`/nextgen/richieste/${input.inquiryId}`);
  await notifyCenterOfParentMessage(supabase, user.id, row.activity_id as string, input.inquiryId, clean.body, false, true);
  return {};
}

// Risposta del Gestore — con la conversazione è un messaggio in più (la
// riga tiene l'ultima risposta in "reply", come prima).
export async function replyToInquiryAction(input: {
  inquiryId: string;
  reply: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const clean = cleanMessageBody(input.reply);
  if (!clean.ok) return { error: clean.error === "Scrivi un messaggio prima di inviare" ? "Scrivi una risposta prima di inviare" : clean.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const at = new Date().toISOString();
  // Segnalazione di Fabrizio: il genitore deve accorgersi che è arrivata una
  // risposta ("un pallino, un pop-up") — read_by_parent torna a false; per il
  // centro, che l'ha appena scritta, è già "letta".
  const { last_message_at: _ignored, ...header } = headerAfterMessage("center", clean.body, at);
  void _ignored;
  const { error } = await supabase
    .from("activity_inquiries")
    .update({ ...header, replied_by: user.id })
    .eq("id", input.inquiryId);

  if (error) return { error: error.message };

  const stored = await appendMessage(supabase, input.inquiryId, user.id, "center", clean.body, at);
  if (stored.error) console.error(`[replyToInquiryAction] messaggio non salvato nella conversazione: ${stored.error}`);

  revalidatePath("/center/richieste");
  revalidatePath(`/center/richieste/${input.inquiryId}`);
  revalidatePath("/richieste");
  revalidatePath("/nextgen/richieste");

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
        body: clean.body,
        // Bug trovato da Fabrizio (01/09/2026): il deepLink deve stare sotto
        // /nextgen (scope della PWA installata), altrimenti Android apre una
        // scheda del browser. 27/10/2026: dritto alla conversazione (la
        // pagina riporta all'elenco se la conversazione è spenta).
        deepLink: `/nextgen/richieste/${input.inquiryId}`,
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
  revalidatePath(input.side === "parent" ? "/nextgen/richieste" : "/center/richieste");
  return {};
}

// Per il foglio "Contatta il gestore": la conversazione è accesa per chi
// scrive? e ce n'è già una aperta su questa attività? (risolto all'apertura
// del foglio, così i componenti che lo usano non devono passare il flag).
export async function getContactContextAction(activityDbId: string): Promise<{
  threads: boolean;
  existingInquiryId: string | null;
}> {
  if (!isSupabaseConfigured) return { threads: false, existingInquiryId: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { threads: false, existingInquiryId: null };
  const threads = await threadsEnabled(user.id, "parent");
  if (!threads) return { threads: false, existingInquiryId: null };
  return { threads, existingInquiryId: await findOpenInquiryForActivity(supabase, user.id, activityDbId) };
}
