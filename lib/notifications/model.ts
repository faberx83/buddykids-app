// TRAMA — Wave 3 "Actionable In-App Notifications" (audit
// docs/trama-one/analysis/TRAMA_PILOT_ARCHITECTURE_REVIEW.md, implementazione
// docs/trama-one/analysis/TRAMA_PILOT_NOTIFICATIONS_IMPLEMENTATION.md).
//
// Logica pura, nessuna dipendenza I/O ("import server-only" ASSENTE apposta,
// stesso principio già stabilito in questo progetto per
// lib/pilot/status.ts/lib/command-center/priority.ts/lib/telemetry/known-events.ts):
// il DTO e le funzioni di ordinamento/conteggio vivono qui così un test
// Playwright "no browser" può importarle direttamente, senza fixture `page`.
//
// PRINCIPIO ARCHITETTURALE: NotificationItem è un DTO applicativo COMPUTATO
// ad ogni lettura da stato di dominio già esistente (group_invites,
// activity_inquiries, bookings, group_requests, carpool_offers/requests) —
// MAI una riga persistita in una tabella "notifications" parallela. L'id è
// deterministico (`${type}:${entityId}`) proprio per garantire che lo stesso
// stato di dominio produca sempre lo stesso identificativo: rileggere due
// volte la stessa condizione non genera due notifiche diverse (deduplica
// strutturale, non un controllo a parte — vedi NOTIF-P10).

export type NotificationPriority = "action" | "important" | "info";

export type NotificationType =
  | "group_invite_pending"
  | "group_request_accepted"
  | "booking_response"
  | "inquiry_reply"
  | "carpool_match_for_my_request"
  | "carpool_match_for_my_offer"
  // Estensione Partner (31/08/2026, "stesso stile" del genitore) — prefisso
  // "center_" per non confondere mai un tipo Genitore con uno Gestore anche
  // solo leggendo il nome, anche se lo stesso DTO/le stesse funzioni pure
  // (sortNotifications/countUnseen/applyClientCursor) restano condivise:
  // vedi lib/data/notifications-partner.ts per le fonti dati.
  | "center_group_request_new"
  | "center_inquiry_new"
  | "center_booking_new"
  | "center_checkins_unconfirmed";

export interface NotificationItem {
  /** Deterministico: `${type}:${entityId}` — mai un uuid random generato qui. */
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  /** Testo breve, MAI il payload completo del record sorgente (privacy). */
  body: string;
  /** ISO — quando lo stato che genera questa notifica è diventato vero. */
  relevantAt: string;
  /**
   * Calcolato QUI dal chiamante (data layer) quando esiste una colonna DB
   * reale (read_by_parent) — altrimenti un default neutro che il client
   * (unica fonte di un "ultimo accesso al center" affidabile per i tipi
   * senza colonna dedicata) può correggere. Vedi NOTIF-P09: seen non
   * equivale MAI a resolved — lo stato di business (pending/accepted/...)
   * resta sempre nel dominio, mai duplicato qui.
   */
  isSeen: boolean;
  requiresAction: boolean;
  deepLink: string;
}

export function makeNotificationId(type: NotificationType, entityId: string): string {
  return `${type}:${entityId}`;
}

// Tipi senza colonna DB dedicata per "letto" (group_requests, carpool_offers,
// carpool_requests non hanno un equivalente di activity_inquiries.read_by_parent):
// SOLO per questi il cursore client-side (localStorage, vedi
// NotificationCenter.tsx) può correggere isSeen. Elencati esplicitamente
// (non "tutti tranne i DB-backed") così un futuro nuovo tipo con una vera
// colonna DB non erediti per errore questo comportamento — vedi NOTIF-P09
// (seen non equivale a resolved: group_invite_pending resta escluso di
// proposito, resta sempre "non visto" finché pending).
export const CLIENT_CURSOR_TYPES: ReadonlySet<NotificationType> = new Set([
  "group_request_accepted",
  "carpool_match_for_my_request",
  "carpool_match_for_my_offer",
  // Partner: group_requests non ha una colonna "letto" (solo status
  // pending/accepted/rejected, stesso motivo di group_request_accepted sopra)
  // e l'aggregato check-in non ha alcuna colonna "letto" possibile (è un
  // conteggio, non un record singolo) — entrambi via cursore client, MAI
  // center_inquiry_new/center_booking_new (quelli hanno read_by_center
  // reale, stesso principio di inquiry_reply/booking_response lato genitore).
  "center_group_request_new",
  "center_checkins_unconfirmed",
]);

// Pura: applica il cursore "ultimo accesso al center" SOLO ai tipi sopra.
// Estratta qui (non nel componente) per essere testabile senza browser.
export function applyClientCursor(items: NotificationItem[], lastSeenAt: string | null): NotificationItem[] {
  if (!lastSeenAt) return items;
  return items.map((item) =>
    CLIENT_CURSOR_TYPES.has(item.type) && item.relevantAt <= lastSeenAt ? { ...item, isSeen: true } : item
  );
}

const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  action: 0,
  important: 1,
  info: 2,
};

// ACTION → IMPORTANT → INFO, poi più recente prima — nessun punteggio
// numerico complesso, stesso principio già in uso per i Promemoria Planner
// (lib/nextgen/reminders.ts, tone urgent>warning>info) e per il Command
// Center Admin (lib/command-center/priority.ts).
export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    const byPriority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (byPriority !== 0) return byPriority;
    return new Date(b.relevantAt).getTime() - new Date(a.relevantAt).getTime();
  });
}

// Badge = UNSEEN, non il totale storico (NOTIF-P08) — un'eventuale
// soglia "9+" è una scelta puramente di presentazione, applicata dal
// componente UI, non da questa funzione (che resta un conteggio esatto).
export function countUnseen(items: NotificationItem[]): number {
  return items.filter((i) => !i.isSeen).length;
}

// Stessa logica/testo di lib/activity-feed.ts#relativeTimeIt (privata a
// quel file, uso Admin) — replicata qui invece di esportarla da un modulo
// semanticamente distante, per la stessa etichetta "quando" nel Notification
// Center Parent.
export function formatRelativeTimeIt(iso: string, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - new Date(iso).getTime());
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return diffMin <= 1 ? "adesso" : `${diffMin} minuti fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} or${diffH === 1 ? "a" : "e"} fa`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "ieri";
  if (diffD < 7) return `${diffD} giorni fa`;
  const diffW = Math.round(diffD / 7);
  return `${diffW} settiman${diffW === 1 ? "a" : "e"} fa`;
}
