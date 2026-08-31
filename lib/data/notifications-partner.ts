// TRAMA — Notification Center Partner (31/08/2026, "stesso stile" del
// genitore, richiesta di Fabrizio). Stessa architettura COMPUTED della Wave 3
// Genitore (lib/data/notifications.ts): nessuna tabella nuova, ogni
// NotificationItem è derivato da stato di dominio già esistente — qui i
// QUATTRO segnali già calcolati oggi per i badge della sidebar Partner
// (app/center/layout.tsx): richieste gruppo in attesa, messaggi genitori non
// letti, check-in da confermare, prenotazioni non lette. Stesse identiche
// fonti dati, stesse funzioni, zero nuove query — REUSE puro, non un
// sistema parallelo.
//
// server-only: stesso principio del resto del data layer Center (mai
// importabile da un Client Component).
import "server-only";

import { getCenterContext } from "@/lib/data/center-admin";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { getInquiriesForCenter } from "@/lib/data/inquiries";
import { getBookingsForCenter } from "@/lib/data/center-bookings";
import { getUnconfirmedCheckinsSignal } from "@/lib/data/attendance";
import { NotificationItem, makeNotificationId, sortNotifications } from "@/lib/notifications/model";

// Aggregato in un'UNICA notifica (non una per record): non esiste, in
// nessun punto dell'app, una pagina di dettaglio per il singolo check-in non
// confermato (solo la vista settimanale /center/attendance) — creare un
// "entity" per riga sarebbe inventare una granularità che l'app stessa non
// ha mai avuto. L'id è deterministico su type+count (vedi model.ts: "id
// deterministico quando la notifica deriva da uno stato esistente... type +
// entity_id + relevant_state" — qui relevant_state=count fa da entity_id):
// cambia solo quando cambia lo stato aggregato reale, non ad ogni render.
function checkinsToNotification(signal: { count: number; mostRecentAt: string | null }): NotificationItem | null {
  if (signal.count === 0 || !signal.mostRecentAt) return null;
  return {
    id: makeNotificationId("center_checkins_unconfirmed", String(signal.count)),
    type: "center_checkins_unconfirmed",
    priority: "action",
    title: "Check-in da confermare",
    body: signal.count === 1 ? "1 check-in in attesa di conferma." : `${signal.count} check-in in attesa di conferma.`,
    relevantAt: signal.mostRecentAt,
    isSeen: false, // corretto dal cursore client (tipo in CLIENT_CURSOR_TYPES, vedi model.ts)
    requiresAction: true,
    deepLink: "/center/attendance",
  };
}

export async function getPartnerNotifications(): Promise<NotificationItem[]> {
  // Fail-closed: se non è un centro autenticato (o platform_admin), nessuna
  // delle 4 funzioni sotto restituirebbe comunque dati (ognuna richiama
  // getCenterContext() in autonomia — stesso principio "mai fidarsi solo di
  // un livello" della Wave 1 Admin), ma verificarlo anche qui evita 4 query
  // a vuoto per un utente non autorizzato.
  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return [];

  const [groupRequests, inquiries, bookings, checkinsSignal] = await Promise.all([
    getGroupRequestsForCenter(),
    getInquiriesForCenter(),
    getBookingsForCenter(),
    getUnconfirmedCheckinsSignal(),
  ]);

  const items: NotificationItem[] = [];

  // 1) Richieste gruppo in attesa — stessa fonte del badge "Richieste
  // Gruppo" (pendingGroupRequests in app/center/layout.tsx). ACTION: il
  // centro deve accettare/rifiutare. Nessuna colonna "letto" per questa
  // tabella (solo status) -> cursore client, come group_request_accepted
  // lato genitore.
  for (const r of groupRequests) {
    if (r.status !== "pending") continue;
    items.push({
      id: makeNotificationId("center_group_request_new", r.id),
      type: "center_group_request_new",
      priority: "action",
      title: "Nuova richiesta gruppo",
      body: `${r.groupName} — ${r.kidsCount} bambin${r.kidsCount === 1 ? "o" : "i"}, sconto ${r.discountPercent}%.`,
      relevantAt: r.createdAt,
      isSeen: false, // corretto dal cursore client
      requiresAction: true,
      deepLink: "/center/group-requests",
    });
  }

  // 2) Richieste/domande dei genitori non lette dal centro — stessa fonte
  // del badge "Le mie richieste" (openInquiries in app/center/layout.tsx,
  // getUnreadCountForCenter). ACTION quando ancora "aperta" (il centro deve
  // rispondere), IMPORTANT altrimenti (caso raro: risposta già data ma
  // segnata non letta). read_by_center è una colonna DB reale -> MAI
  // corretto dal cursore client (stesso principio di inquiry_reply lato
  // genitore).
  for (const inq of inquiries) {
    if (inq.readByCenter) continue;
    items.push({
      id: makeNotificationId("center_inquiry_new", inq.id),
      type: "center_inquiry_new",
      priority: inq.status === "aperta" ? "action" : "important",
      title: "Nuova richiesta da un genitore",
      body: `${inq.parentName} — ${inq.activityName}.`,
      relevantAt: inq.createdAt,
      isSeen: false,
      requiresAction: inq.status === "aperta",
      deepLink: "/center/richieste",
    });
  }

  // 3) Prenotazioni non lette — stessa fonte del badge "Prenotazioni"
  // (unreadBookings in app/center/layout.tsx, getUnreadBookingsCountForCenter:
  // read_by_center=false, status != cancelled). ACTION quando il centro deve
  // ancora decidere (partnerDecision=pending), IMPORTANT per un
  // aggiornamento non letto su una prenotazione già decisa (es. il genitore
  // ha cancellato un giorno). read_by_center è una colonna DB reale -> MAI
  // corretto dal cursore client (stesso principio di booking_response lato
  // genitore).
  for (const b of bookings) {
    if (b.readByCenter || b.status === "cancelled") continue;
    items.push({
      id: makeNotificationId("center_booking_new", b.id),
      type: "center_booking_new",
      priority: b.partnerDecision === "pending" ? "action" : "important",
      title: b.partnerDecision === "pending" ? "Nuova prenotazione" : "Aggiornamento prenotazione",
      body: `${b.parentName} — ${b.activityName}.`,
      relevantAt: b.createdAt,
      isSeen: false,
      requiresAction: b.partnerDecision === "pending",
      deepLink: "/center/prenotazioni",
    });
  }

  // 4) Check-in da confermare — un'unica notifica aggregata (vedi
  // checkinsToNotification sopra).
  const checkinsItem = checkinsToNotification(checkinsSignal);
  if (checkinsItem) items.push(checkinsItem);

  return sortNotifications(items);
}
