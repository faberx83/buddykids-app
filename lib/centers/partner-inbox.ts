// TRAMA — PORTALE CENTRI V2, RICHIESTE (29/10/2026, tavole 4 e 5 del mock).
// Prenotazioni, messaggi e richieste di gruppo in un elenco solo, con "Da
// rispondere" in cima. Logica pura, nessun I/O: dai dati che le pagine di oggi
// già leggono (getBookingsForCenter, getInquiriesForCenter,
// getGroupRequestsForCenter) alle righe dell'elenco. Le risposte restano le
// azioni di sempre (app/actions/booking-response.ts, groups.ts, inquiries.ts).
// Testata in tests/one/partner-inbox-v2.spec.ts.

import { bookingNeedsAction, effectiveDayBasedDecision } from "@/lib/booking-response/effective-decision";
import type { CenterBooking, DayPartnerDecision, PartnerDecision } from "@/lib/data/center-bookings";

export type InboxKind = "prenotazione" | "messaggio" | "gruppo";
export type InboxFilter = "tutte" | InboxKind;

export const INBOX_FILTERS: { key: InboxFilter; label: string; query: string | null }[] = [
  { key: "tutte", label: "Tutte", query: null },
  { key: "prenotazione", label: "Prenotazioni", query: "prenotazioni" },
  { key: "messaggio", label: "Messaggi", query: "messaggi" },
  { key: "gruppo", label: "Gruppi", query: "gruppi" },
];

/** ?tipo=prenotazioni|messaggi|gruppi → filtro (vecchi link e le schede di prima). */
export function filterFromQuery(tipo: string | string[] | undefined | null): InboxFilter {
  const v = Array.isArray(tipo) ? tipo[0] : tipo;
  return INBOX_FILTERS.find((f) => f.query === v)?.key ?? "tutte";
}

export interface InboxStatus {
  label: string;
  /** Tono del bollino: da fare, fatto, in attesa dell'altro, chiuso. */
  tone: "todo" | "done" | "waiting" | "closed";
}

export interface InboxItem {
  kind: InboxKind;
  id: string;
  /** Prima riga: bambini, famiglia o gruppo. */
  title: string;
  /** Seconda riga: attività e date. */
  detail: string;
  /** Per ordinare e per "2 ore fa". */
  at: string;
  needsAnswer: boolean;
  unread: boolean;
  status: InboxStatus;
  /** Messaggi: dove si apre la conversazione. */
  href?: string;
}

// ─── Date ──────────────────────────────────────────────────────────────

const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
    .replace(/\./g, "");

/** "7 dic", "7 e 8 dic", "3 giorni dal 22 dic", "settimana dal 6 lug". */
export function bookingDatesLabel(b: Pick<CenterBooking, "isDayBased" | "days" | "weeks">): string {
  if (b.isDayBased) {
    const dates = b.days.map((d) => d.date).filter(Boolean).sort();
    if (dates.length === 0) return "";
    if (dates.length === 1) return shortDay(dates[0]);
    if (dates.length === 2) {
      const [a, c] = dates;
      return a.slice(0, 7) === c.slice(0, 7) ? `${Number(a.slice(8))} e ${shortDay(c)}` : `${shortDay(a)} e ${shortDay(c)}`;
    }
    return `${dates.length} giorni dal ${shortDay(dates[0])}`;
  }
  const weeks = b.weeks.map((w) => w.startDate).filter(Boolean).sort();
  if (weeks.length === 0) return "";
  return weeks.length === 1 ? `settimana dal ${shortDay(weeks[0])}` : `${weeks.length} settimane dal ${shortDay(weeks[0])}`;
}

/** "adesso", "15 min fa", "2 ore fa", "ieri", "3 giorni fa", "12 ott". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((now.getTime() - t) / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "1 ora fa" : `${h} ore fa`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ieri";
  if (d < 7) return `${d} giorni fa`;
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" }).format(new Date(iso)).replace(/\./g, "");
}

// ─── Stato di una prenotazione ─────────────────────────────────────────

export const DAY_DECISION: Record<DayPartnerDecision, { label: string; tone: InboxStatus["tone"] }> = {
  pending: { label: "Da rispondere", tone: "todo" },
  accepted: { label: "Accettato", tone: "done" },
  rejected: { label: "Rifiutato", tone: "closed" },
  waitlisted: { label: "In lista d'attesa", tone: "waiting" },
};

export function bookingDecision(b: CenterBooking): PartnerDecision {
  return b.isDayBased ? effectiveDayBasedDecision(b.days.map((d) => d.partnerDecision), b.partnerDecision) : b.partnerDecision;
}

export function bookingStatus(b: CenterBooking): InboxStatus {
  if (b.status === "cancelled") {
    return b.cancelledBy === "parent" ? { label: "Annullata dalla famiglia", tone: "closed" } : { label: "Rifiutata", tone: "closed" };
  }
  if (bookingNeedsAction(b)) {
    const waiting = b.isDayBased && b.days.some((d) => d.partnerDecision === "waitlisted") && !b.days.some((d) => d.partnerDecision === "pending");
    return waiting ? { label: "Lista d'attesa", tone: "waiting" } : { label: "Da rispondere", tone: "todo" };
  }
  switch (bookingDecision(b)) {
    case "accepted":
      return { label: "Accettata", tone: "done" };
    case "partial":
      return { label: "Accettata in parte", tone: "done" };
    case "proposed":
      return { label: "Proposta alla famiglia", tone: "waiting" };
    case "rejected":
      return { label: "Rifiutata", tone: "closed" };
    default:
      return { label: "Da rispondere", tone: "todo" };
  }
}

// ─── Elenco unico ─────────────────────────────────────────────────────

export interface InboxMessageInput {
  id: string;
  parentName: string;
  activityName: string;
  createdAt: string;
  lastMessageAt?: string;
  readByCenter: boolean;
  /** Chi ha scritto per ultimo: se la famiglia, tocca al centro. */
  lastSide: "parent" | "center";
  lastText: string;
}

export interface InboxGroupInput {
  id: string;
  groupName: string;
  activityName: string;
  kidsCount: number;
  discountPercent: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  message?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildInboxItems(input: {
  bookings: CenterBooking[];
  messages: InboxMessageInput[];
  groups: InboxGroupInput[];
}): InboxItem[] {
  const items: InboxItem[] = [];
  for (const b of input.bookings) {
    const dates = bookingDatesLabel(b);
    items.push({
      kind: "prenotazione",
      id: b.id,
      title: b.kidNames.length > 0 ? b.kidNames.join(", ") : b.parentName || "Prenotazione",
      detail: [b.activityName, dates].filter(Boolean).join(" · "),
      at: b.createdAt,
      needsAnswer: b.status !== "cancelled" && bookingNeedsAction(b),
      unread: !b.readByCenter,
      status: bookingStatus(b),
    });
  }
  for (const m of input.messages) {
    const needs = m.lastSide === "parent";
    items.push({
      kind: "messaggio",
      id: m.id,
      title: m.parentName || "Famiglia",
      detail: [m.activityName, m.lastText ? `“${m.lastText.slice(0, 80)}${m.lastText.length > 80 ? "…" : ""}”` : ""].filter(Boolean).join(" · "),
      at: m.lastMessageAt ?? m.createdAt,
      needsAnswer: needs,
      unread: !m.readByCenter,
      status: needs ? { label: "Da rispondere", tone: "todo" } : { label: "Risposto", tone: "done" },
      href: `/center/richieste/${m.id}`,
    });
  }
  for (const g of input.groups) {
    items.push({
      kind: "gruppo",
      id: g.id,
      title: g.groupName,
      detail: [g.activityName, plural(g.kidsCount, "bambino", "bambini"), g.discountPercent > 0 ? `sconto ${g.discountPercent}%` : ""]
        .filter(Boolean)
        .join(" · "),
      at: g.createdAt,
      needsAnswer: g.status === "pending",
      unread: g.status === "pending",
      status:
        g.status === "pending"
          ? { label: "Da rispondere", tone: "todo" }
          : g.status === "accepted"
            ? { label: "Accettata", tone: "done" }
            : { label: "Rifiutata", tone: "closed" },
    });
  }
  // Da rispondere: la più vecchia prima (chi aspetta da più tempo). Il resto: la più recente prima.
  const todo = items.filter((i) => i.needsAnswer).sort((a, b) => a.at.localeCompare(b.at));
  const done = items.filter((i) => !i.needsAnswer).sort((a, b) => b.at.localeCompare(a.at));
  return [...todo, ...done];
}

export function filterInbox(items: InboxItem[], filter: InboxFilter): InboxItem[] {
  return filter === "tutte" ? items : items.filter((i) => i.kind === filter);
}

/** Quante cose da rispondere per filtro (per i numeri sulle schede). */
export function toAnswerCounts(items: InboxItem[]): Record<InboxFilter, number> {
  const c: Record<InboxFilter, number> = { tutte: 0, prenotazione: 0, messaggio: 0, gruppo: 0 };
  for (const i of items) {
    if (!i.needsAnswer) continue;
    c.tutte += 1;
    c[i.kind] += 1;
  }
  return c;
}

/** Il riassunto sotto il titolo. */
export function inboxSummary(counts: Record<InboxFilter, number>): string {
  if (counts.tutte === 0) return "Niente da rispondere. Le nuove richieste arrivano qui e per email.";
  const parts = [
    counts.prenotazione > 0 ? plural(counts.prenotazione, "prenotazione", "prenotazioni") : null,
    counts.messaggio > 0 ? plural(counts.messaggio, "messaggio", "messaggi") : null,
    counts.gruppo > 0 ? plural(counts.gruppo, "richiesta di gruppo", "richieste di gruppo") : null,
  ].filter((x): x is string => x !== null);
  const list = parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return `Da rispondere: ${list}.`;
}

// ─── Foglio di una prenotazione ────────────────────────────────────────

/** "4 posti liberi su 12", "pieno", "ultimi 2 posti". */
export function spotsLabel(spotsLeft: number, capacity: number): { text: string; tone: "ok" | "few" | "full" | "unknown" } {
  if (!capacity || capacity <= 0) return { text: "posti non impostati", tone: "unknown" };
  if (spotsLeft <= 0) return { text: "pieno", tone: "full" };
  if (spotsLeft <= 2) return { text: spotsLeft === 1 ? "ultimo posto" : `ultimi ${spotsLeft} posti`, tone: "few" };
  return { text: `${spotsLeft} liberi su ${capacity}`, tone: "ok" };
}

/** Servizi scelti dalla famiglia, in parole. */
export function chosenServices(b: Pick<CenterBooking, "preServiceIncluded" | "postServiceIncluded" | "mealIncluded" | "shuttleIncluded">): string[] {
  return [
    b.preServiceIncluded ? "Ingresso anticipato" : null,
    b.postServiceIncluded ? "Uscita posticipata" : null,
    b.mealIncluded ? "Pasto" : null,
    b.shuttleIncluded ? "Navetta" : null,
  ].filter((x): x is string => x !== null);
}

/** Riepilogo dopo "Accetta"/"Rifiuta" su più giorni (stessi conteggi dell'azione di sempre). */
export function dayBulkSummary(r: { accepted: number; rejected: number; waitlisted: number; waitlistUnavailable: number; failed: number }): string {
  const parts: string[] = [];
  if (r.accepted > 0) parts.push(`${plural(r.accepted, "giorno accettato", "giorni accettati")}`);
  if (r.rejected > 0) parts.push(`${plural(r.rejected, "giorno rifiutato", "giorni rifiutati")}`);
  if (r.waitlisted > 0) parts.push(`${plural(r.waitlisted, "giorno pieno: in lista d'attesa", "giorni pieni: in lista d'attesa")}`);
  if (r.waitlistUnavailable > 0) parts.push(`${plural(r.waitlistUnavailable, "giorno pieno rimasto da decidere", "giorni pieni rimasti da decidere")}`);
  if (r.failed > 0) parts.push(`${plural(r.failed, "errore", "errori")}, riprovate`);
  return parts.join(" · ");
}
