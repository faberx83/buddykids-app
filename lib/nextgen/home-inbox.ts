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
  | "school_missing"
  | "profile_incomplete"
  | "push_inactive";

/** Ordine di priorità di "Da fare" (dal più urgente). */
export const HOME_INBOX_PRIORITY: readonly HomeInboxKind[] = [
  "booking_rejected",
  "coordination_soon",
  "booking_partial",
  "group_invite",
  "school_missing",
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
  /** Primo e ultimo giorno prenotato (ISO). Servono per il periodo compatto
   *  ("5–9 luglio") e per escludere le prenotazioni già concluse. */
  firstDate?: string | null;
  lastDate?: string | null;
  /** Solo prenotazioni a giorni: giorni confermati sul totale. */
  acceptedDayCount?: number;
  totalDayCount?: number;
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
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED), UX-PARENT-006:
   *  figli senza scuola. Assente = nessuna voce (comportamento di prima). La
   *  voce resta finché ogni figlio ha la scuola, anche dopo il benvenuto. */
  schoolMissingKids?: { id: string; name: string }[];
  /** Correzioni dal test UX (21/10/2026), primi passi: senza figli la prima
   *  azione è "Aggiungi i tuoi figli" (nel benvenuto), quindi "Completa il
   *  profilo" aspetta. Assente/false = come prima. */
  noKidsYet?: boolean;
  /** Oggi (ISO). Se presente, le prenotazioni già concluse non entrano in
   *  "Da fare" (segnalazione live 14/10: una conferma parziale di settembre
   *  compariva ancora a ottobre). */
  todayIso?: string;
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

const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "5–9 luglio", "28 luglio – 1 agosto", "7 settembre". */
export function compactDateRange(firstIso: string, lastIso: string): string {
  const a = new Date(firstIso + "T00:00:00Z");
  const b = new Date(lastIso + "T00:00:00Z");
  const ma = MONTHS_IT[a.getUTCMonth()];
  const mb = MONTHS_IT[b.getUTCMonth()];
  if (firstIso === lastIso) return `${a.getUTCDate()} ${ma}`;
  if (ma === mb && a.getUTCFullYear() === b.getUTCFullYear()) return `${a.getUTCDate()}–${b.getUTCDate()} ${ma}`;
  return `${a.getUTCDate()} ${ma} – ${b.getUTCDate()} ${mb}`;
}

function bookingWhen(b: HomeInboxBookingInput): string {
  if (b.partnerDecision === "partial" && (b.totalDayCount ?? 0) > 0) {
    const total = b.totalDayCount ?? 0;
    const accepted = b.acceptedDayCount ?? 0;
    return `${accepted} ${accepted === 1 ? "giorno" : "giorni"} su ${total}`;
  }
  if (b.firstDate && b.lastDate) return compactDateRange(b.firstDate, b.lastDate);
  return b.weeksLabel.trim();
}

function bookingDetail(b: HomeInboxBookingInput): string {
  const who = joinNames(b.kidNames);
  const when = bookingWhen(b);
  const tail = [who, when].filter(Boolean).join(", ");
  return tail ? `${b.activityName} · ${tail}` : b.activityName;
}

const MOMENT_VERB: Record<Moment, string> = { andata: "accompagna", ritorno: "ritira" };

export function buildHomeInbox(input: HomeInboxInput): HomeInboxResult {
  const items: HomeInboxItem[] = [];
  const today = input.todayIso;
  const active = input.bookings.filter(
    (b) => b.status !== "cancelled" && !(today && b.lastDate && b.lastDate < today)
  );

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

  const missingSchool = input.schoolMissingKids ?? [];
  if (missingSchool.length > 0) {
    const first = missingSchool[0];
    items.push({
      id: "school_missing",
      kind: "school_missing",
      title: missingSchool.length === 1 ? `Indica la scuola di ${first.name}` : `Indica la scuola di ${joinNames(missingSchool.map((k) => k.name))}`,
      detail: "Ti avvisiamo prima di ogni ponte e vacanza",
      ctaLabel: "Imposta",
      href: `/nextgen/profile/famiglia?scuola=${encodeURIComponent(first.id)}`,
    });
  }

  if (input.profileIncomplete && !input.noKidsYet) {
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
