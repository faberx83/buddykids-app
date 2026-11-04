// TRAMA — CONFERMA PARZIALE: IMPORTO E MESSAGGIO CHIARI ALLA FAMIGLIA
// (decisione di Fabrizio, 04/11/2026: "sì, ci vuole notifica chiara per le
// famiglie").
//
// Prima: quando il centro rifiutava alcuni giorni, bookings.total_amount
// restava quello di tutti i giorni (portale centri: importo intero), mentre
// la famiglia vedeva una quota calcolata a parte; e arrivava un'email per
// ogni giorno ("Giorno confermato…", "Giorno non accettato…"), con
// "Contatta il centro" e nessun importo. In app la notifica di una
// conferma parziale diceva "Il centro ha una proposta per te".
// Ora:
//   - l'importo salvato conta solo i giorni non rifiutati (accettati e
//     ancora in attesa), con la regola comune (lib/booking-amounts.ts): stessa
//     cifra nei due portali;
//   - una sola email per risposta del centro, che dice quali giorni sono
//     confermati, quali no, quali restano in attesa, e il nuovo importo;
//   - la notifica in app dice "Confermata in parte" con giorni e importo.
// Funzioni pure, testate in tests/one/qa-prod-0411.spec.ts.

import { amountsForCountedDays, type StoredAmounts } from "@/lib/booking-amounts";

export type DayDecision = "pending" | "accepted" | "rejected" | "waitlisted";

export interface DecidedDay {
  date: string;
  price: number;
  decision: DayDecision;
}

/** Giorni che contano nell'importo: tutti tranne i rifiutati. */
export function countedDayPrices(days: DecidedDay[]): number[] {
  return days.filter((d) => d.decision !== "rejected").map((d) => Number(d.price) || 0);
}

/** Importo da salvare dopo le risposte del centro (idempotente). */
export function amountsAfterDecisions(input: {
  previous: StoredAmounts;
  days: DecidedDay[];
  kidsCount: number;
  familyTiers: number[];
}): StoredAmounts {
  return amountsForCountedDays({
    previous: input.previous,
    countedDayPrices: countedDayPrices(input.days),
    kidsCount: input.kidsCount,
    familyTiers: input.familyTiers,
  });
}

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "7, 8 e 9 dicembre", "30 novembre e 1 dicembre". */
export function datesLabel(isoDates: string[]): string {
  const sorted = [...new Set(isoDates)].sort();
  if (sorted.length === 0) return "";
  const parts = sorted.map((iso) => {
    const d = new Date(iso + "T00:00:00Z");
    return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
  });
  const out: string[] = [];
  parts.forEach((p, i) => {
    const next = parts[i + 1];
    out.push(next && next.month === p.month ? String(p.day) : `${p.day} ${p.month}`);
  });
  return out.length === 1 ? out[0] : `${out.slice(0, -1).join(", ")} e ${out[out.length - 1]}`;
}

const eur = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;

export interface DayDecisionsMessage {
  subject: string;
  paragraphs: string[];
}

/**
 * Email unica dopo una risposta del centro sui giorni. `days` = stato di
 * TUTTI i giorni della prenotazione dopo la risposta.
 */
export function dayDecisionsMessage(input: {
  firstName: string | null;
  activityName: string;
  days: DecidedDay[];
  totalAmount: number;
  previousTotal: number;
}): DayDecisionsMessage {
  const accepted = input.days.filter((d) => d.decision === "accepted").map((d) => d.date);
  const rejected = input.days.filter((d) => d.decision === "rejected").map((d) => d.date);
  const waitlisted = input.days.filter((d) => d.decision === "waitlisted").map((d) => d.date);
  const pending = input.days.filter((d) => d.decision === "pending").map((d) => d.date);
  const greeting = `Ciao${input.firstName ? ` ${input.firstName}` : ""},`;
  const name = input.activityName;
  const p: string[] = [greeting];

  let subject: string;
  if (accepted.length > 0 && rejected.length > 0) subject = `Confermata in parte: ${name}`;
  else if (accepted.length > 0 && rejected.length === 0 && waitlisted.length === 0 && pending.length === 0) subject = `Prenotazione confermata: ${name}`;
  else if (accepted.length === 0 && rejected.length > 0 && waitlisted.length === 0 && pending.length === 0) subject = `Prenotazione non accettata: ${name}`;
  else if (waitlisted.length > 0 && accepted.length === 0) subject = `In lista d'attesa: ${name}`;
  else subject = `Il centro ha risposto: ${name}`;

  if (accepted.length > 0) p.push(`Confermati: ${datesLabel(accepted)}.`);
  if (rejected.length > 0) p.push(`Non accettati: ${datesLabel(rejected)}. Questi giorni non si pagano.`);
  if (waitlisted.length > 0) p.push(`In lista d'attesa: ${datesLabel(waitlisted)}. Vi avvisiamo se si libera un posto.`);
  if (pending.length > 0) p.push(`Il centro deve ancora rispondere per: ${datesLabel(pending)}.`);

  const total = Number(input.totalAmount) || 0;
  const before = Number(input.previousTotal) || 0;
  if (accepted.length + waitlisted.length + pending.length === 0) p.push("Non c'è niente da pagare.");
  else if (total !== before) p.push(`Importo aggiornato: ${eur(total)} (prima ${eur(before)}).`);
  else p.push(`Importo: ${eur(total)}.`);

  return { subject, paragraphs: p };
}

/** Notifica in app per una conferma parziale. */
export function partialNotificationText(input: {
  activityName: string;
  acceptedDayCount: number;
  totalDayCount: number;
  stillPendingDayCount: number;
  totalAmount: number;
}): { title: string; body: string } {
  const a = input.acceptedDayCount;
  const parts = [`Confermati ${a} ${a === 1 ? "giorno" : "giorni"} su ${input.totalDayCount}.`];
  if (input.stillPendingDayCount > 0) parts.push(`Per ${input.stillPendingDayCount === 1 ? "1 giorno" : `${input.stillPendingDayCount} giorni`} il centro deve ancora rispondere.`);
  parts.push(`Importo aggiornato: ${eur(Number(input.totalAmount) || 0)}; i giorni non accettati non si pagano.`);
  return { title: `Confermata in parte: ${input.activityName}`, body: parts.join(" ") };
}
