import "server-only";

// TRAMA — Wave 3 "Actionable In-App Notifications" (audit
// TRAMA_PILOT_ARCHITECTURE_REVIEW.md, implementazione
// docs/trama-one/analysis/TRAMA_PILOT_NOTIFICATIONS_IMPLEMENTATION.md).
//
// getParentNotifications() è l'AGGREGATORE: nessuna nuova tabella, nessun
// evento duplicato — legge lo stato di dominio già esistente (riusando le
// stesse funzioni/data-layer già scritte per le UI corrispondenti) e lo
// trasforma in NotificationItem[] (lib/notifications/model.ts).
//
// SICUREZZA (stesso principio del PRE-DEPLOY SECURITY CHECK già applicato a
// lib/data/pilot-users.ts, Wave 1): l'autorizzazione vive QUI, non solo nel
// layout — questa funzione verifica sessione + ruolo REALE "parent" PRIMA di
// qualunque query, fail-closed silenzioso (array vuoto). Anche se
// NextgenLayout non blocca oggi un Partner/Admin autenticato dall'aprire
// /nextgen (nessun redirect per ruolo, solo per sessione assente), un
// Partner/Admin non deve MAI ricevere il notification center del genitore
// (NOTIF-P11) — la garanzia non può dipendere da "quella pagina non gli
// viene mostrata".

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMyGroupInvites } from "@/lib/data/groups";
import { getInquiriesForParent } from "@/lib/data/inquiries";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getRecentAcceptedGroupRequests } from "@/lib/data/coordination-signal";
import { getCarpoolMatchSignals } from "@/lib/data/carpool-signals";
import { NotificationItem, makeNotificationId, sortNotifications } from "@/lib/notifications/model";

async function isCurrentUserParent(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // nessuna sessione autenticata

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "parent"; // stesso default già in uso altrove (profilo appena creato)
  if (role !== "parent") return null;

  return { userId: user.id };
}

// Limite di sicurezza sul numero di elementi "richieste gruppo accettate"
// considerati — stesso principio già in uso per i Promemoria Planner (max
// 4): un centro notification non deve mai diventare una lista infinita.
const MAX_ACCEPTED_GROUP_REQUESTS = 5;

export async function getParentNotifications(): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const current = await isCurrentUserParent(supabase);
  if (!current) return [];
  const { userId } = current;

  const [invites, inquiries, bookings, acceptedGroupRequests, carpool] = await Promise.all([
    getMyGroupInvites(),
    getInquiriesForParent(),
    getMyBookingsForParent(),
    getRecentAcceptedGroupRequests(supabase, userId, MAX_ACCEPTED_GROUP_REQUESTS),
    getCarpoolMatchSignals(userId),
  ]);

  const items: NotificationItem[] = [];

  // ── P0 — Invito a gruppo (sezione 7) ──────────────────────────────────
  // ACTION, sempre "non visto" finché resta pending/sent (getMyGroupInvites
  // filtra già solo questi stati): SEEN ≠ RESOLVED, aprire il center non
  // equivale ad accettare — vedi lib/notifications/model.ts.
  for (const invite of invites) {
    items.push({
      id: makeNotificationId("group_invite_pending", invite.id),
      type: "group_invite_pending",
      priority: "action",
      title: `Sei stato invitato al gruppo "${invite.groupName}"`,
      body: "Accetta o rifiuta per unirti al gruppo.",
      relevantAt: invite.createdAt,
      isSeen: false,
      requiresAction: true,
      deepLink: "/nextgen/groups?tab=inviti",
    });
  }

  // ── P0 — Risposta a una richiesta al centro (sezione 8) ───────────────
  // Riusa read_by_parent (activity_inquiries) tale e quale: nessun secondo
  // stato di business. IMPORTANT (non ACTION): non c'è altro da FARE oltre
  // a leggerla, questo ticketing è "un solo giro" (vedi app/actions/inquiries.ts).
  for (const inquiry of inquiries) {
    if (inquiry.status !== "risposta" || inquiry.readByParent) continue;
    items.push({
      id: makeNotificationId("inquiry_reply", inquiry.id),
      type: "inquiry_reply",
      priority: "important",
      title: `${inquiry.activityName}: il centro ha risposto`,
      body: "Hai una nuova risposta alla tua richiesta.",
      relevantAt: inquiry.repliedAt ?? inquiry.createdAt,
      isSeen: false, // read_by_parent è già false qui (filtro sopra)
      requiresAction: false,
      deepLink: "/nextgen/richieste",
    });
  }

  // ── P0 — Risposta del centro a una prenotazione (sezione 8) ───────────
  // Riusa read_by_parent (bookings) e partner_decision tale e quale.
  // ACTION solo per "proposed" (il genitore deve accettare/rifiutare la
  // proposta alternativa) — accepted/rejected sono IMPORTANT: la decisione
  // del centro è già definitiva, non richiede un'azione del genitore oltre
  // a prenderne atto.
  for (const booking of bookings) {
    if (booking.readByParent || booking.partnerDecision === "pending") continue;
    const isProposal = booking.partnerDecision === "proposed";
    const title =
      booking.partnerDecision === "accepted"
        ? `Prenotazione confermata: ${booking.activityName}`
        : booking.partnerDecision === "rejected"
          ? `Prenotazione non confermata: ${booking.activityName}`
          : `Il centro ha una proposta per te: ${booking.activityName}`;
    items.push({
      id: makeNotificationId("booking_response", booking.id),
      type: "booking_response",
      priority: isProposal ? "action" : "important",
      title,
      body: isProposal ? "Rivedi la proposta del centro e rispondi." : "Il centro ha risposto alla tua prenotazione.",
      relevantAt: booking.respondedAt ?? booking.createdAt,
      isSeen: false, // read_by_parent è già false qui (filtro sopra)
      requiresAction: isProposal,
      deepLink: `/nextgen/prenotazioni?bookingId=${booking.id}`,
    });
  }

  // ── P0 — Richiesta gruppo accettata dal centro (sezione 9) ────────────
  // Stessa fonte/finestra di 14gg del Coordination Signal Home (Wave 2,
  // refactor condiviso in lib/data/coordination-signal.ts) — IMPORTANT,
  // nessuna azione richiesta (lo sconto è già applicato). isSeen di default
  // qui è un placeholder neutro: non esiste una colonna DB "letto" per
  // group_requests, quindi il valore reale è calcolato lato client con un
  // cursore "ultimo accesso al center" (vedi NotificationCenter.tsx) — MAI
  // persistito lato server per restare nell'architettura COMPUTED (nessuna
  // migration necessaria).
  for (const req of acceptedGroupRequests) {
    items.push({
      id: makeNotificationId("group_request_accepted", req.id),
      type: "group_request_accepted",
      priority: "important",
      title: `Richiesta gruppo accettata`,
      body: `Il centro ha accettato la richiesta del gruppo "${req.groupName}" — sconto ${req.discountPercent}%.`,
      relevantAt: req.respondedAt,
      isSeen: false,
      requiresAction: false,
      deepLink: `/nextgen/groups/${req.groupId}`,
    });
  }

  // ── P0 — Carpool (sezione 10) ──────────────────────────────────────────
  // Riusa matchesForRequest (lib/carpool.ts, pura) via
  // lib/data/carpool-signals.ts. ACTION in entrambe le direzioni: un
  // abbinamento compatibile è sempre "qualcosa da guardare e possibilmente
  // rispondere" (mettersi d'accordo con l'altro genitore), non solo
  // un'informazione passiva. Stesso isSeen "placeholder", stesso cursore
  // client-side degli altri tipi senza colonna DB dedicata.
  for (const m of carpool.forMyRequest) {
    items.push({
      id: makeNotificationId("carpool_match_for_my_request", m.ownEntityId),
      type: "carpool_match_for_my_request",
      priority: "action",
      title: `Passaggio disponibile per il gruppo "${m.groupName}"`,
      body: "C'è un'offerta di passaggio compatibile con la tua richiesta.",
      relevantAt: m.matchedAt,
      isSeen: false,
      requiresAction: true,
      deepLink: `/nextgen/groups/${m.groupId}`,
    });
  }
  for (const m of carpool.forMyOffer) {
    items.push({
      id: makeNotificationId("carpool_match_for_my_offer", m.ownEntityId),
      type: "carpool_match_for_my_offer",
      priority: "action",
      title: `Qualcuno ha bisogno di un passaggio nel gruppo "${m.groupName}"`,
      body: "C'è una richiesta di passaggio compatibile con la tua offerta.",
      relevantAt: m.matchedAt,
      isSeen: false,
      requiresAction: true,
      deepLink: `/nextgen/groups/${m.groupId}`,
    });
  }

  return sortNotifications(items);
}
