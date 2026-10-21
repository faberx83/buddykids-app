// TRAMA — HOME V2 (Fase 1, 13/10/2026). Logica pura di "Oggi": una sola
// timeline della famiglia che mescola, senza gerarchia, prenotazioni TRAMA,
// Scoperte aggiunte al Planner e impegni aggiunti a mano. Pensata per essere
// riusata dalla vista Settimana del Planner V2 (stessa riga, stesso
// linguaggio), che oggi NON è ancora implementata.
//
// Coordinamento: il modello dati attuale (week_responsibilities) lega chi
// accompagna/ritira a figlio + giorno + momento, NON alla singola attività.
// summarizeDayCoordination quindi lavora per giornata e per figlio, mai per
// occorrenza (nessuna responsabilità simulata per singolo impegno).

import { occursOn, type WeeklyRecurrence } from "@/lib/planner/recurrence";
import type { Moment } from "@/lib/nextgen/responsibility-options";

export type AgendaSource = "trama" | "scoperta" | "manuale";

export const AGENDA_SOURCE_LABEL: Record<AgendaSource, string> = {
  trama: "TRAMA",
  scoperta: "Scoperta TRAMA",
  manuale: "Aggiunto da te",
};

export interface AgendaKid {
  id: string;
  name: string;
}

export interface AgendaEntry {
  id: string;
  /** 21/10/2026 — settimana tipo: è l'orario della scuola (riga discreta in agenda). */
  school?: boolean;
  /** "HH:MM" oppure null (tutto il giorno / orario non noto). */
  startTime: string | null;
  endTime: string | null;
  title: string;
  place: string | null;
  kids: AgendaKid[];
  source: AgendaSource;
  /** Stato utile da mostrare (es. "In attesa del centro"), altrimenti null. */
  status: string | null;
}

export interface AgendaBookingInput {
  id: string;
  status: string;
  partnerDecision: string;
  activityName: string;
  activityDbId: string | null;
  centerName: string;
  isDayBased: boolean;
  dayDates: string[];
  weeks: { startDate: string; endDate: string }[];
  kidIds: string[];
  kidNames: string[];
}

export interface AgendaExternalInput {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  sourceType: string;
  kidIds: string[];
  /** 21/10/2026 — settimana tipo (lib/planner/recurrence.ts): solo i giorni scelti. Assente = ogni giorno del periodo. */
  recurrence?: WeeklyRecurrence | null;
  /** 21/10/2026 — orario della scuola (impegno ricorrente speciale). */
  isSchool?: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function normalizeTime(h: string, m: string | undefined): string | null {
  const hh = Number(h);
  const mm = m === undefined ? 0 : Number(m);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh > 23 || mm > 59) return null;
  return `${pad2(hh)}:${pad2(mm)}`;
}

/**
 * Estrae inizio e fine da activities.hours (testo libero del gestore, es.
 * "08:00 - 17:30", "8.30-16", "dalle 9 alle 17"). null se non riconoscibile:
 * meglio nessun orario che un orario inventato.
 */
export function parseHoursRange(hours: string | null | undefined): { start: string; end: string } | null {
  if (!hours) return null;
  const matches = Array.from(hours.matchAll(/(\d{1,2})(?:[:.](\d{2}))?/g));
  if (matches.length < 2) return null;
  const start = normalizeTime(matches[0][1], matches[0][2]);
  const end = normalizeTime(matches[1][1], matches[1][2]);
  if (!start || !end || end <= start) return null;
  return { start, end };
}

/** "HH:MM" o "HH:MM:SS" → "HH:MM"; null se non valido. */
export function trimTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  return m ? normalizeTime(m[1], m[2]) : null;
}

/** true per lunedì-venerdì (le prenotazioni a settimana intera valgono solo nei feriali). */
export function isWeekdayIso(iso: string): boolean {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return day >= 1 && day <= 5;
}

function sourceOfExternal(sourceType: string): AgendaSource {
  return sourceType === "curated_discovery" || sourceType === "community_discovery" ? "scoperta" : "manuale";
}

function bookingIsToday(b: AgendaBookingInput, todayIso: string): boolean {
  if (b.isDayBased) return b.dayDates.includes(todayIso);
  if (!isWeekdayIso(todayIso)) return false;
  return b.weeks.some((w) => w.startDate <= todayIso && todayIso <= w.endDate);
}

function bookingStatus(b: AgendaBookingInput): string | null {
  if (b.partnerDecision === "partial") return "Confermata in parte";
  if (b.status === "pending" || b.partnerDecision === "pending" || b.partnerDecision === "proposed") {
    return "In attesa del centro";
  }
  return null;
}

export function buildTodayAgenda(input: {
  todayIso: string;
  bookings: AgendaBookingInput[];
  externalItems: AgendaExternalInput[];
  hoursByActivityDbId: Record<string, string | undefined>;
  kidNameById: Record<string, string>;
  /** 21/10/2026: giorni di scuola chiusa — l'orario della scuola quel giorno non c'è. */
  schoolClosedDates?: string[];
}): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  const schoolClosed = new Set(input.schoolClosedDates ?? []);

  for (const b of input.bookings) {
    if (b.status === "cancelled" || b.partnerDecision === "rejected") continue;
    if (!bookingIsToday(b, input.todayIso)) continue;
    const range = parseHoursRange(b.activityDbId ? input.hoursByActivityDbId[b.activityDbId] : null);
    entries.push({
      id: `booking:${b.id}`,
      startTime: range?.start ?? null,
      endTime: range?.end ?? null,
      title: b.activityName,
      place: b.centerName || null,
      kids: b.kidIds.map((id, i) => ({ id, name: b.kidNames[i] ?? input.kidNameById[id] ?? "" })),
      source: "trama",
      status: bookingStatus(b),
    });
  }

  for (const item of input.externalItems) {
    if (!occursOn(item, input.todayIso)) continue;
    if (item.isSchool && schoolClosed.has(input.todayIso)) continue;
    entries.push({
      id: `external:${item.id}`,
      ...(item.isSchool ? { school: true } : {}),
      startTime: item.allDay ? null : trimTime(item.startTime),
      endTime: item.allDay ? null : trimTime(item.endTime),
      title: item.title,
      place: item.location,
      kids: item.kidIds.map((id) => ({ id, name: input.kidNameById[id] ?? "" })).filter((k) => k.name),
      source: sourceOfExternal(item.sourceType),
      status: null,
    });
  }

  // Cronologico: prima ciò che dura tutto il giorno o non ha orario, poi per
  // ora di inizio; a parità, ordine alfabetico del titolo (deterministico).
  return entries.sort((a, b) => {
    const ka = a.startTime ?? "";
    const kb = b.startTime ?? "";
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.title.localeCompare(b.title, "it");
  });
}

// ─── Coordinamento della giornata ────────────────────────────────────────

export interface DayCoordinationSlotInput {
  kidId: string;
  kidName: string;
  moment: Moment;
  /** Chi se ne occupa (etichetta già risolta); null = nessuno. */
  label: string | null;
}

export interface DayCoordinationKid {
  kidId: string;
  kidName: string;
  /** undefined = nessun passaggio richiesto per quel momento. */
  andata?: string | null;
  ritorno?: string | null;
}

export interface DayCoordinationSummary {
  /** none: nessun passaggio oggi; compact: tutto deciso; detailed: manca qualcuno. */
  mode: "none" | "compact" | "detailed";
  kids: DayCoordinationKid[];
  missingCount: number;
  /** Persone coinvolte, senza ripetizioni, nell'ordine in cui compaiono. */
  people: string[];
}

export function summarizeDayCoordination(slots: DayCoordinationSlotInput[]): DayCoordinationSummary {
  if (slots.length === 0) return { mode: "none", kids: [], missingCount: 0, people: [] };
  const byKid = new Map<string, DayCoordinationKid>();
  const people: string[] = [];
  let missingCount = 0;
  for (const s of slots) {
    const kid = byKid.get(s.kidId) ?? { kidId: s.kidId, kidName: s.kidName };
    kid[s.moment] = s.label;
    byKid.set(s.kidId, kid);
    if (s.label === null) missingCount += 1;
    else if (!people.includes(s.label)) people.push(s.label);
  }
  return {
    mode: missingCount > 0 ? "detailed" : "compact",
    kids: Array.from(byKid.values()),
    missingCount,
    people,
  };
}

/** "Papà", "Papà e Mamma", "Papà, Mamma e Nonna". */
export function joinPeople(people: string[]): string {
  if (people.length <= 1) return people[0] ?? "";
  return `${people.slice(0, -1).join(", ")} e ${people[people.length - 1]}`;
}
