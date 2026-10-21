// TRAMA — CHI ACCOMPAGNA PIÙ VELOCE (20/10/2026, release "chi-accompagna-veloce").
// Fabrizio: "se assegno qualcosa in un giorno, dovrebbe propormi di
// applicarlo a tutto l'impegno se plurigiornaliero" e "se chi è assegnato è
// già utente TRAMA riceve notifica (solo l'assegnatario, una per giro)".
// Regole pure (niente rete), usate dal foglio "Chi accompagna" del Planner
// V2, dall'azione di invio e dai test.

import type { AgendaBookingInput, AgendaExternalInput } from "@/lib/nextgen/today-agenda";
import type { Moment, ResponsibleValue } from "@/lib/nextgen/responsibility-options";
import { occurrenceDates, occursOn } from "@/lib/planner/recurrence";

export const CHI_ACCOMPAGNA_PLUS_FLAG = "CHI_ACCOMPAGNA_PLUS_ENABLED";

/** Al massimo sei mesi avanti: un impegno "tutto l'anno" non scrive centinaia di righe. */
export const APPLY_ALL_HORIZON_DAYS = 182;

export interface CommitmentDays {
  /** "booking:<id>" | "external:<id>" (stessi id dell'agenda). */
  key: string;
  title: string;
  /** Gli ALTRI giorni feriali futuri dello stesso impegno per quel figlio (escluso il giorno scelto). */
  dates: string[];
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekdayIso(iso: string): boolean {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return day >= 1 && day <= 5;
}

function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDaysIso(d, 1)) if (isWeekdayIso(d)) out.push(d);
  return out;
}

/** Lunedì della settimana di una data. */
export function mondayOf(iso: string): string {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return addDaysIso(iso, -((day + 6) % 7));
}

/**
 * Gli impegni del figlio in quel giorno che durano più giorni, con gli altri
 * giorni feriali futuri (da oggi, fino a sei mesi). Vuoto = niente da
 * proporre (impegno di un giorno solo o già finito).
 */
export function otherDaysOfCommitments(input: {
  dateIso: string;
  todayIso: string;
  kidId: string;
  bookings: Pick<AgendaBookingInput, "id" | "status" | "partnerDecision" | "activityName" | "kidIds" | "weeks" | "dayDates">[];
  externalItems: Pick<AgendaExternalInput, "id" | "title" | "startDate" | "endDate" | "kidIds" | "recurrence" | "isSchool">[];
}): CommitmentDays[] {
  const from = input.todayIso;
  const until = addDaysIso(input.todayIso, APPLY_ALL_HORIZON_DAYS);
  const keep = (dates: string[]) =>
    Array.from(new Set(dates))
      .filter((d) => d !== input.dateIso && d >= from && d <= until && isWeekdayIso(d))
      .sort();
  const out: CommitmentDays[] = [];

  for (const b of input.bookings) {
    if (b.status === "cancelled" || b.partnerDecision === "rejected" || !b.kidIds.includes(input.kidId)) continue;
    const all = [...b.dayDates, ...b.weeks.flatMap((w) => weekdaysBetween(w.startDate, w.endDate))];
    if (!all.includes(input.dateIso)) continue;
    const dates = keep(all);
    if (dates.length > 0) out.push({ key: `booking:${b.id}`, title: b.activityName, dates });
  }
  for (const item of input.externalItems) {
    if (!item.kidIds.includes(input.kidId) || item.isSchool) continue;
    if (!occursOn(item, input.dateIso)) continue;
    // 21/10/2026: un impegno ricorrente propone solo i suoi giorni (es. ogni mercoledì).
    const dates = keep(item.recurrence ? occurrenceDates(item, from, until) : weekdaysBetween(item.startDate, item.endDate));
    if (dates.length > 0) out.push({ key: `external:${item.id}`, title: item.title, dates });
  }
  return out;
}

// ─── Notifica all'altro genitore ────────────────────────────────────────

export interface AssignChange {
  dateIso: string;
  kidName: string;
  moment: Moment;
  /** true = ora tocca a lui/lei; false = non più. */
  assigned: boolean;
}

/**
 * Chi riceve la notifica: solo quando la scelta è "partner" (l'altro
 * genitore, visto da chi assegna). Nonni, tata e "Altro" non hanno un
 * account: per loro il foglio propone di mandare il piano.
 */
export function isPartnerChoice(responsible: ResponsibleValue | null | undefined): boolean {
  return responsible === "partner";
}

const DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function shortDayIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Ultima scelta per ogni passaggio: se in un giro assegni e poi togli, conta l'ultima. */
export function collapseChanges(changes: AssignChange[]): AssignChange[] {
  const map = new Map<string, AssignChange>();
  for (const c of changes) map.set(`${c.dateIso}|${c.kidName}|${c.moment}`, c);
  return Array.from(map.values()).sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.kidName.localeCompare(b.kidName));
}

export const ASSIGN_NOTICE_MAX_LINES = 5;

/**
 * Testo della notifica. `tag` unico per giro (nonce): toglie i doppioni dello
 * stesso giro su più iscrizioni dello stesso telefono, ma un giro nuovo
 * suona di nuovo (non sostituisce in silenzio quello di prima).
 */
export function buildAssignNotice(input: { fromName: string | null; changes: AssignChange[]; nonce: string }): {
  title: string;
  body: string;
  deepLink: string;
  tag: string;
} | null {
  const changes = collapseChanges(input.changes);
  if (changes.length === 0) return null;
  const who = input.fromName?.trim() || "L'altro genitore";
  const added = changes.filter((c) => c.assigned);
  const title =
    added.length === 0
      ? `${who} ha cambiato chi accompagna`
      : added.length === 1
        ? `${who} ti ha affidato un passaggio`
        : `${who} ti ha affidato ${added.length} passaggi`;
  const line = (c: AssignChange) =>
    `${shortDayIt(c.dateIso)} · ${c.assigned ? "" : "non "}${c.moment === "andata" ? "porti" : "ritiri"}${c.assigned ? "" : " più"} ${c.kidName}`;
  const lines = changes.slice(0, ASSIGN_NOTICE_MAX_LINES).map(line);
  if (changes.length > ASSIGN_NOTICE_MAX_LINES) lines.push(`+ altri ${changes.length - ASSIGN_NOTICE_MAX_LINES}`);
  return {
    title,
    body: lines.join("\n"),
    deepLink: `/nextgen/planner?week=${mondayOf(changes[0].dateIso)}&panel=chi`,
    tag: `chi-accompagna-${input.nonce}`,
  };
}
