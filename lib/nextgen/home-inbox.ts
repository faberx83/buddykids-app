// TRAMA — HOME V2 (Fase 1, 13/10/2026). Logica pura della Home V2:
// "Da fare" (una sola lista, max 3 visibili, una CTA per voce) e l'alert
// sopra "Oggi". Nessun import server-side: usata da app/nextgen/page.tsx
// (server) e da HomeDashboardV2Client.tsx (client), testata in
// tests/one/home-v2.spec.ts.
//
// Regola UX formalizzata (V2.1, decisione di Fabrizio del 13/10/2026):
// l'alert sopra "Oggi" compare SOLO per un problema operativo urgente della
// giornata corrente (oggi manca chi accompagna o chi ritira). Profilo
// incompleto, inviti, conferme parziali future, push e simili restano in
// "Da fare" — la Home non deve tornare a riempirsi di banner.

import type { Moment } from "@/lib/nextgen/responsibility-options";

export type HomeInboxKind =
  | "booking_rejected"
  | "coordination_soon"
  | "booking_partial"
  | "group_invite"
  | "profile_incomplete"
  | "push_inactive";

/** Ordine di priorità di "Da fare" (dal più urgente). */
export const HOME_INBOX_PRIORITY: readonly HomeInboxKind[] = [
  "booking_rejected",
  "coordination_soon",
  "booking_partial",
  "group_invite",
  "profile_incomplete",
  "push_inactive",
];

/** Quante voci mostra "Da fare" prima di "Vedi tutte". */
export const HOME_INBOX_VISIBLE_MAX = 3;

export interface HomeInboxItem {
  id: string;
  kind: HomeInboxKind;
  title: string;
  detail: string;
  ctaLabel: string;
  /** null = azione lato client (oggi solo "Attiva" per le notifiche push). */
  href: string | null;
}

export interface HomeInboxBookingInput {
  id: string;
  status: string;
  partnerDecision: string;
  activityName: string;
  kidNames: string[];
  weeksLabel: string;
}

export interface HomeInboxGroupInviteInput {
  id: string;
  groupName: string;
  inviterName: string | null;
  activityName: string | null;
}

/** Passaggi (andata/ritorno) ancora da assegnare nei prossimi giorni, OGGI ESCLUSO. */
export interface HomeInboxUpcomingCoordinationInput {
  missingCount: number;
  firstKidName: string | null;
  firstMoment: Moment | null;
  firstDate: string | null;
  weekStartDate: string | null;
}

export interface HomeInboxInput {
  bookings: HomeInboxBookingInput[];
  upcomingCoordination: HomeInboxUpcomingCoordinationInput | null;
  groupInvites: HomeInboxGroupInviteInput[];
  profileIncomplete: boolean;
  pushInactive: boolean;
}

export interface HomeInboxResult {
  /** Tutte le voci, già ordinate per priorità. */
  all: HomeInboxItem[];
  /** Le prime HOME_INBOX_VISIBLE_MAX. */
  visible: HomeInboxItem[];
}

function joinNames(names: string[]): string {
  const clean = names.filter((n) => n.trim().length > 0);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

function bookingDetail(b: HomeInboxBookingInput): string {
  const who = joinNames(b.kidNames);
  const when = b.weeksLabel.trim();
  const tail = [who, when].filter(Boolean).join(", ");
  return tail ? `${b.activityName} · ${tail}` : b.activityName;
}

const MOMENT_VERB: Record<Moment, string> = { andata: "accompagna", ritorno: "ritira" };

export function buildHomeInbox(input: HomeInboxInput): HomeInboxResult {
  const items: HomeInboxItem[] = [];
  const active = input.bookings.filter((b) => b.status !== "cancelled");

  for (const b of active.filter((x) => x.partnerDecision === "rejected")) {
    items.push({
      id: `booking_rejected:${b.id}`,
      kind: "booking_rejected",
      title: "Richiesta non accettata",
      detail: bookingDetail(b),
      ctaLabel: "Vedi",
      href: "/nextgen/prenotazioni",
    });
  }

  const coord = input.upcomingCoordination;
  if (coord && coord.missingCount > 0) {
    const first =
      coord.firstKidName && coord.firstMoment
        ? `Il primo: chi ${MOMENT_VERB[coord.firstMoment]} ${coord.firstKidName}`
        : "Chi accompagna e chi ritira";
    items.push({
      id: "coordination_soon",
      kind: "coordination_soon",
      title: coord.missingCount === 1 ? "1 passaggio da assegnare" : `${coord.missingCount} passaggi da assegnare`,
      detail: first,
      ctaLabel: "Assegna",
      href: coord.weekStartDate
        ? `/nextgen/planner?mode=calendario&week=${coord.weekStartDate}`
        : "/nextgen/planner?mode=calendario",
    });
  }

  for (const b of active.filter((x) => x.partnerDecision === "partial")) {
    items.push({
      id: `booking_partial:${b.id}`,
      kind: "booking_partial",
      title: "Confermata in parte",
      detail: bookingDetail(b),
      ctaLabel: "Controlla",
      href: "/nextgen/prenotazioni",
    });
  }

  for (const inv of input.groupInvites) {
    const detail = [inv.inviterName ? `Da ${inv.inviterName}` : null, inv.activityName].filter(Boolean).join(" · ");
    items.push({
      id: `group_invite:${inv.id}`,
      kind: "group_invite",
      title: `Invito al gruppo ${inv.groupName}`,
      detail: detail || "Accetta o rifiuta l'invito",
      ctaLabel: "Rispondi",
      href: "/nextgen/groups",
    });
  }

  if (input.profileIncomplete) {
    items.push({
      id: "profile_incomplete",
      kind: "profile_incomplete",
      title: "Completa il profilo",
      detail: "Nome e ruolo in famiglia",
      ctaLabel: "Completa",
      href: "/nextgen/profile?complete=1",
    });
  }

  if (input.pushInactive) {
    items.push({
      id: "push_inactive",
      kind: "push_inactive",
      title: "Attiva le notifiche",
      detail: "Un avviso sul telefono per le cose importanti",
      ctaLabel: "Attiva",
      href: null,
    });
  }

  const rank = (k: HomeInboxKind) => HOME_INBOX_PRIORITY.indexOf(k);
  // sort stabile (ES2019+): a parità di tipo resta l'ordine di inserimento
  const all = items.slice().sort((a, b) => rank(a.kind) - rank(b.kind));
  return { all, visible: all.slice(0, HOME_INBOX_VISIBLE_MAX) };
}

// ─── Alert sopra "Oggi" ─────────────────────────────────────────────────

export interface DayCoordinationEntryInput {
  /** ISO yyyy-mm-dd del giorno a cui si riferisce lo slot. */
  date: string;
  kidId: string;
  kidName: string;
  moment: Moment;
  /** Etichetta di chi se ne occupa; null = nessuno assegnato. */
  label: string | null;
}

export interface UrgentTodayAlert {
  text: string;
  missingCount: number;
  href: string;
}

/**
 * L'alert compare SOLO se oggi manca chi accompagna o chi ritira: ogni
 * slot con date diversa da todayIso viene ignorato (quelli dei prossimi
 * giorni finiscono in "Da fare" come coordination_soon).
 */
export function selectUrgentTodayAlert(
  entries: DayCoordinationEntryInput[],
  todayIso: string,
  weekStartIso: string
): UrgentTodayAlert | null {
  const missing = entries.filter((e) => e.date === todayIso && e.label === null);
  if (missing.length === 0) return null;
  const text =
    missing.length === 1
      ? `Manca chi ${MOMENT_VERB[missing[0].moment]} ${missing[0].kidName} oggi`
      : `Oggi mancano ${missing.length} accompagnamenti`;
  return {
    text,
    missingCount: missing.length,
    href: `/nextgen/planner?mode=calendario&week=${weekStartIso}`,
  };
}
