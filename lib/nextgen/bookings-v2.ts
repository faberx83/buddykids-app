// TRAMA — PRENOTAZIONI V2 (14/10/2026, tavole "TRAMA Scopri e Prenotazioni
// V2"). Logica pura della pagina Prenotazioni: In arrivo / Passate,
// raggruppamento per mese, stato con le stesse parole e gli stessi colori
// di Home e Planner, "Da sistemare". Nessuna query.
// Testata in tests/one/scopri-prenotazioni-v2.spec.ts.

import { compactDateRange } from "@/lib/nextgen/home-inbox";
import { amountBeforeDiscount, amountDue } from "@/lib/booking-amounts";

const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const WD_SHORT = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];

export interface BookingV2Input {
  id: string;
  status: string;
  partnerDecision: string;
  activityName: string;
  weeks: { startDate: string; endDate: string }[];
  dayDates: string[];
  isDayBased: boolean;
  kidIds: string[];
  kidNames: string[];
  totalAmount: number;
  discountAmount: number;
  acceptedDayCount: number;
  totalDayCount: number;
  waitlistedDayCount: number;
  /** Giorni ancora senza risposta (in attesa o in lista d'attesa). Assente = come prima. */
  stillPendingDayCount?: number;
  partnerProposalNote: string | null;
}

export type BookingTone = "green" | "amber" | "red" | "violet" | "gray";

export interface BookingChip {
  label: string;
  tone: BookingTone;
}

export function bookingSpan(b: Pick<BookingV2Input, "weeks" | "dayDates">): { first: string | null; last: string | null } {
  const starts = [...b.weeks.map((w) => w.startDate), ...b.dayDates].sort();
  const ends = [...b.weeks.map((w) => w.endDate), ...b.dayDates].sort();
  return { first: starts[0] ?? null, last: ends[ends.length - 1] ?? null };
}

/**
 * Quanto paga la famiglia. QA 04/11/2026 (EXTRA-01): total_amount è già
 * scontato; prima qui si toglieva di nuovo discount_amount (€57 → €54).
 * Regola unica: lib/booking-amounts.ts.
 */
export function netPrice(b: Pick<BookingV2Input, "totalAmount" | "discountAmount">): number {
  return amountDue(b);
}

/**
 * Quota confermata di una prenotazione. 04/11/2026: per le conferme parziali
 * l'importo salvato conta già solo i giorni non rifiutati (accettati + ancora
 * in attesa, lib/booking-response/day-decisions-message.ts), quindi la quota
 * è sui giorni ancora in gioco, non su tutti quelli chiesti.
 */
export function confirmedShare(b: Pick<BookingV2Input, "partnerDecision" | "totalAmount" | "discountAmount" | "acceptedDayCount" | "totalDayCount" | "stillPendingDayCount">): number {
  const amount = netPrice(b);
  if (b.partnerDecision !== "partial") return amount;
  if (b.stillPendingDayCount === undefined) {
    return b.totalDayCount > 0 ? Math.round((amount * b.acceptedDayCount) / b.totalDayCount) : amount;
  }
  const inPlay = b.acceptedDayCount + b.stillPendingDayCount;
  return inPlay > 0 ? Math.round((amount * b.acceptedDayCount) / inPlay) : 0;
}

/** Prezzo prima degli sconti (barrato). */
export function priceBeforeDiscount(b: Pick<BookingV2Input, "totalAmount" | "discountAmount">): number {
  return amountBeforeDiscount(b);
}

export function bookingChip(b: BookingV2Input): BookingChip {
  if (b.status === "cancelled") return { label: "Annullata", tone: "gray" };
  if (b.partnerDecision === "rejected") return { label: "Non accettata", tone: "red" };
  if (b.partnerDecision === "partial") return { label: "Confermata in parte", tone: "amber" };
  if (b.partnerDecision === "proposed") return { label: "Proposta del centro", tone: "violet" };
  if (b.waitlistedDayCount > 0 && b.partnerDecision === "pending") return { label: "In lista d'attesa", tone: "amber" };
  if (b.status === "pending" || b.partnerDecision === "pending") return { label: "In attesa del centro", tone: "amber" };
  return { label: "Confermata", tone: "green" };
}

/** "7–8 dicembre", "2 giorni su 3" per le conferme parziali. */
export function bookingWhen(b: BookingV2Input): string {
  if (b.partnerDecision === "partial" && b.totalDayCount > 0) {
    return `${b.acceptedDayCount} ${b.acceptedDayCount === 1 ? "giorno" : "giorni"} su ${b.totalDayCount}`;
  }
  const { first, last } = bookingSpan(b);
  if (!first || !last) return "";
  if (b.isDayBased && b.dayDates.length > 1) {
    const contiguous = b.dayDates.length === new Set(b.dayDates).size && spanDays(first, last) === b.dayDates.length;
    if (!contiguous) return `${b.dayDates.length} giorni tra ${compactDateRange(first, last)}`;
  }
  return compactDateRange(first, last);
}

function spanDays(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000) + 1;
}

/** Quadratino data: { wd: "LUN", day: 7, month: "DIC" }. */
export function dateTile(iso: string): { wd: string; day: number; month: string } {
  const d = new Date(iso + "T00:00:00Z");
  return { wd: WD_SHORT[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS_IT[d.getUTCMonth()].slice(0, 3).toUpperCase() };
}

export interface BookingMonthGroup<T> {
  label: string;
  items: T[];
}

/** Non annullate e non ancora finite (comprese le non accettate). */
export function futureBookings<T extends BookingV2Input>(bookings: T[], todayIso: string): T[] {
  return bookings.filter((b) => {
    const { last } = bookingSpan(b);
    return b.status !== "cancelled" && (last === null || last >= todayIso);
  });
}

/**
 * In arrivo: non annullate, non rifiutate e non ancora finite (in ordine di
 * data). Passate: finite, annullate o non accettate (dalla più recente).
 * Le non accettate future stanno in "Da sistemare" (bookingsToFix su
 * futureBookings), non tra quelle in arrivo: non succederanno.
 */
export function splitBookings<T extends BookingV2Input>(bookings: T[], todayIso: string): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  const future = new Set(futureBookings(bookings, todayIso));
  for (const b of bookings) {
    if (future.has(b) && b.partnerDecision !== "rejected") upcoming.push(b);
    else past.push(b);
  }
  const key = (b: T) => bookingSpan(b).first ?? "9999";
  upcoming.sort((a, b) => key(a).localeCompare(key(b)));
  past.sort((a, b) => key(b).localeCompare(key(a)));
  return { upcoming, past };
}

export function groupByMonth<T extends BookingV2Input>(items: T[], todayIso: string): BookingMonthGroup<T>[] {
  const groups: BookingMonthGroup<T>[] = [];
  const thisYear = todayIso.slice(0, 4);
  for (const b of items) {
    const first = bookingSpan(b).first;
    const label = first
      ? `${MONTHS_IT[Number(first.slice(5, 7)) - 1]}${first.slice(0, 4) !== thisYear ? ` ${first.slice(0, 4)}` : ""}`
      : "senza data";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(b);
    else groups.push({ label, items: [b] });
  }
  return groups;
}

export interface BookingToFix {
  bookingId: string;
  kind: "rejected" | "partial" | "proposed";
  title: string;
  detail: string;
  ctaLabel: string;
  /** Prima data: per "Alternative" (Scopri su quella settimana). */
  firstDate: string | null;
}

/** "Da sistemare": stesse parole del "Da fare" della Home, solo prenotazioni in arrivo. */
export function bookingsToFix(upcoming: BookingV2Input[]): BookingToFix[] {
  const out: BookingToFix[] = [];
  for (const b of upcoming) {
    const who = b.kidNames.join(" e ");
    const detail = [b.activityName, [who, bookingWhen(b)].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    const first = bookingSpan(b).first;
    if (b.partnerDecision === "rejected")
      out.push({ bookingId: b.id, kind: "rejected", title: "Richiesta non accettata", detail, ctaLabel: "Alternative", firstDate: first });
    else if (b.partnerDecision === "partial")
      out.push({ bookingId: b.id, kind: "partial", title: "Confermata in parte", detail, ctaLabel: "Controlla", firstDate: first });
    else if (b.partnerDecision === "proposed")
      out.push({ bookingId: b.id, kind: "proposed", title: "Il centro propone una modifica", detail, ctaLabel: "Vedi", firstDate: first });
  }
  const rank = { rejected: 0, proposed: 1, partial: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * "1 in arrivo · €30 di prenotazioni confermate nel 2026".
 * 03/11/2026 (report Parent del 30/10, REV-PARENT-001): prima "€30 spesi
 * quest'anno" dopo un'accettazione senza alcun pagamento. TRAMA non registra
 * pagamenti: è il valore delle prenotazioni CONFERMATE dal centro (in attesa,
 * rifiutate e annullate escluse), non una spesa.
 */
export function bookingsSummaryLine(bookings: BookingV2Input[], todayIso: string): string {
  const { upcoming: active } = splitBookings(bookings, todayIso);
  const year = todayIso.slice(0, 4);
  const confirmed = bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        (b.partnerDecision === "accepted" || b.partnerDecision === "partial") &&
        (bookingSpan(b).first ?? "").startsWith(year)
    )
    // Confermata in parte: solo la quota dei giorni accettati.
    .reduce((s, b) => s + confirmedShare(b), 0);
  const parts = [active.length === 0 ? "Niente in arrivo" : active.length === 1 ? "1 in arrivo" : `${active.length} in arrivo`];
  if (confirmed > 0) parts.push(`€${confirmed.toLocaleString("it-IT")} di prenotazioni confermate nel ${year}`);
  return parts.join(" · ");
}

/** Stato spiegato a parole nella prenotazione aperta. */
export function bookingStatusExplainer(b: BookingV2Input): string | null {
  if (b.status === "cancelled") return "Prenotazione annullata.";
  if (b.partnerDecision === "rejected") return "Il centro non può accoglierla. Cerca un'alternativa per le stesse date.";
  if (b.partnerDecision === "proposed") return b.partnerProposalNote ? `Il centro propone: ${b.partnerProposalNote}` : "Il centro ha proposto una modifica.";
  if (b.partnerDecision === "partial")
    return `Il centro ha confermato ${b.acceptedDayCount} ${b.acceptedDayCount === 1 ? "giorno" : "giorni"} su ${b.totalDayCount}.`;
  if (b.waitlistedDayCount > 0 && b.partnerDecision === "pending") return "Alcuni giorni sono pieni: ti avvisiamo se si libera un posto.";
  if (b.status === "pending" || b.partnerDecision === "pending") return "Il centro deve ancora rispondere. Ti avvisiamo appena conferma.";
  return null;
}
