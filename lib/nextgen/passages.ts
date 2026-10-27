// TRAMA — CHI ACCOMPAGNA PER PASSAGGIO (22/10/2026, Fase B della settimana
// tipo, release "chi-accompagna-per-passaggio"). Fabrizio, sul venerdì di
// Noemi: "gli spostamenti sono 4: a/r da scuola e a/r palestra… uscita da
// scuola e ingresso in palestra potrebbe sicuramente essere lo stesso
// passaggio ma va indicato".
//
// Logica pura, senza rete:
//   - dayLegs: i passaggi di un figlio in una giornata. Ogni impegno con
//     orario ha un'andata (inizio) e un ritorno (fine); la scuola entra in
//     gioco solo se nella giornata c'è anche altro (da sola non crea
//     passaggi, come prima).
//   - resolveLegs: chi se ne occupa. Prima la scelta per quel passaggio
//     (passage_responsibilities, migration 51); se manca, la scelta "del
//     giorno" di sempre (week_responsibilities) vale per la PRIMA andata e
//     l'ULTIMO ritorno — così i dati di prima restano dove erano; i passaggi
//     in mezzo sono da decidere.
//   - groupTrips: un ritorno seguito entro un'ora da un'andata in un altro
//     posto è UN viaggio, dichiarato ("Da scuola a RITMICA · un viaggio"):
//     una scelta vale per entrambi; se le persone sono diverse il viaggio
//     si mostra diviso.
// Test: tests/one/passages.spec.ts.

import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import type { Moment, ResponsibleValue } from "@/lib/nextgen/responsibility-options";

export const PASSAGE_RESPONSIBILITIES_FLAG = "PASSAGE_RESPONSIBILITIES_ENABLED";
export const SCHOOL_PASSAGE_KEY = "school";
/** Ritorno → andata entro questo tempo, in due posti diversi: un viaggio solo. */
export const TRIP_MAX_GAP_MINUTES = 60;

export interface PassageResponsibility {
  kidId: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "school" | "booking:<id>" | "external:<id>" */
  passageKey: string;
  moment: Moment;
  responsible: ResponsibleValue;
  responsibleLabel: string | null;
  familyPersonId?: string | null;
}

export interface Leg {
  /** `${passageKey}|${moment}` — unico nella giornata di un figlio. */
  key: string;
  passageKey: string;
  moment: Moment;
  /** "HH:MM" o null (tutto il giorno / orario non noto). */
  time: string | null;
  school: boolean;
  /** Titolo dell'impegno ("RITMICA"); "Scuola" per la scuola. */
  title: string;
  /** Nome della scuola, se scritto (non "Scuola"). */
  schoolName: string | null;
  place: string | null;
  /** Fine dell'impegno, per "fino alle 19:00" sull'andata. */
  endTime: string | null;
  status: string | null;
}

export interface ResolvedLeg extends Leg {
  label: string | null;
  /** Da dove viene la scelta: il passaggio stesso, la scelta del giorno, nessuna. */
  source: "passage" | "day" | null;
  row: PassageResponsibility | null;
}

export const legKey = (passageKey: string, moment: Moment) => `${passageKey}|${moment}`;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * I passaggi di un figlio in una giornata, in ordine di orario.
 * 26/10/2026 (Fabrizio: "non vedo nulla per i giorni di solo scuola"): anche
 * la sola scuola ha i suoi due passaggi (entra, esce); con "Anche gli altri
 * giorni di scuola?" si decidono una volta per tutte.
 */
export function dayLegs(entries: AgendaEntry[], kidId: string): Leg[] {
  const mine = entries.filter((e) => e.kids.some((k) => k.id === kidId));
  if (mine.length === 0) return [];
  const legs: Leg[] = [];
  const seenSchool = new Set<Moment>();
  for (const e of mine) {
    const passageKey = e.school ? SCHOOL_PASSAGE_KEY : e.id;
    const title = e.school ? "Scuola" : e.title;
    const schoolName = e.school && e.title && e.title !== "Scuola" ? e.title : null;
    const base = { passageKey, school: Boolean(e.school), title, schoolName, place: e.place, endTime: hhmm(e.endTime), status: e.status };
    for (const moment of ["andata", "ritorno"] as const) {
      if (e.school && seenSchool.has(moment)) continue; // una sola scuola al giorno
      if (e.school) seenSchool.add(moment);
      legs.push({ ...base, key: legKey(passageKey, moment), moment, time: moment === "andata" ? hhmm(e.startTime) : hhmm(e.endTime) });
    }
  }
  // Tutto il giorno prima; poi per orario; a parità di orario il ritorno
  // prima dell'andata (esce alle 16:30, entra alle 16:30 altrove) e
  // l'andata di un impegno prima del suo ritorno.
  return legs.sort((a, b) => {
    if (a.time !== b.time) {
      if (a.time === null) return -1;
      if (b.time === null) return 1;
      return a.time < b.time ? -1 : 1;
    }
    if (a.passageKey === b.passageKey) return a.moment === "andata" ? -1 : 1;
    return a.moment === b.moment ? 0 : a.moment === "ritorno" ? -1 : 1;
  });
}

/**
 * Chi se ne occupa, passaggio per passaggio. `dayChoice` è la scelta del
 * giorno di sempre (week_responsibilities): undefined = il giorno non la
 * prevede (es. sabato), null = da decidere, stringa = etichetta.
 */
export function resolveLegs(input: {
  legs: Leg[];
  kidId: string;
  date: string;
  rows: PassageResponsibility[];
  labelFor: (row: PassageResponsibility) => string;
  dayChoice?: { andata?: string | null; ritorno?: string | null };
}): ResolvedLeg[] {
  const firstAndata = input.legs.find((l) => l.moment === "andata")?.key ?? null;
  const lastRitorno = [...input.legs].reverse().find((l) => l.moment === "ritorno")?.key ?? null;
  return input.legs.map((leg) => {
    const row =
      input.rows.find((r) => r.kidId === input.kidId && r.date === input.date && r.passageKey === leg.passageKey && r.moment === leg.moment) ?? null;
    if (row) return { ...leg, label: input.labelFor(row) || null, source: "passage" as const, row };
    const day = leg.key === firstAndata ? input.dayChoice?.andata : leg.key === lastRitorno ? input.dayChoice?.ritorno : undefined;
    if (day) return { ...leg, label: day, source: "day" as const, row: null };
    return { ...leg, label: null, source: null, row: null };
  });
}

export type DayPassageStep =
  | { kind: "leg"; leg: ResolvedLeg }
  | {
      kind: "trip";
      from: ResolvedLeg;
      to: ResolvedLeg;
      /** Persone diverse (o una sola delle due scelta): il viaggio si mostra diviso. */
      split: boolean;
    };

/** Unisce in un viaggio un ritorno e l'andata successiva entro un'ora, in due posti diversi. */
export function groupTrips(legs: ResolvedLeg[], maxGapMinutes = TRIP_MAX_GAP_MINUTES): DayPassageStep[] {
  const out: DayPassageStep[] = [];
  for (let i = 0; i < legs.length; i += 1) {
    const a = legs[i];
    const b = legs[i + 1];
    if (
      b &&
      a.moment === "ritorno" &&
      b.moment === "andata" &&
      a.passageKey !== b.passageKey &&
      a.time !== null &&
      b.time !== null &&
      minutes(b.time) >= minutes(a.time) &&
      minutes(b.time) - minutes(a.time) <= maxGapMinutes
    ) {
      out.push({ kind: "trip", from: a, to: b, split: a.label !== b.label });
      i += 1;
      continue;
    }
    out.push({ kind: "leg", leg: a });
  }
  return out;
}

/** Quanti "da decidere": un viaggio intero conta uno; diviso, conta i suoi pezzi. */
export function missingPassages(steps: DayPassageStep[]): number {
  let n = 0;
  for (const s of steps) {
    if (s.kind === "leg") n += s.leg.label === null ? 1 : 0;
    else if (!s.split) n += s.from.label === null ? 1 : 0;
    else n += (s.from.label === null ? 1 : 0) + (s.to.label === null ? 1 : 0);
  }
  return n;
}

/** "Da scuola a RITMICA", "Da RITMICA a Inglese". */
export function tripTitle(from: Leg, to: Leg): string {
  return `Da ${from.school ? "scuola" : from.title} a ${to.school ? "scuola" : to.title}`;
}

/** Nome breve di un passaggio nel foglio "Chi accompagna": "Entra a scuola", "Porta a RITMICA", "Ritiro da RITMICA". */
export function legLabel(leg: Leg): string {
  if (leg.school) return leg.moment === "andata" ? "Entra a scuola" : "Esce da scuola";
  return leg.moment === "andata" ? `Porta a ${leg.title}` : `Ritiro da ${leg.title}`;
}

/**
 * Quali scelte scrivere anche come "scelta del giorno" (week_responsibilities):
 * la prima andata e l'ultimo ritorno, perché Home, promemoria della sera e
 * piano condiviso leggono ancora quella. Solo dal lunedì al venerdì.
 */
export function dayMirrorFor(legs: Leg[], key: string): Moment | null {
  const firstAndata = legs.find((l) => l.moment === "andata")?.key;
  const lastRitorno = [...legs].reverse().find((l) => l.moment === "ritorno")?.key;
  if (key === firstAndata) return "andata";
  if (key === lastRitorno) return "ritorno";
  return null;
}

// ─── "Anche gli altri giorni di RITMICA?" ──────────────────────────────

export interface PassageTarget {
  kidId: string;
  date: string;
  passageKey: string;
  moment: Moment;
}

/** Al massimo sei mesi avanti (come "tutto l'impegno" di prima). */
export const PASSAGE_APPLY_HORIZON_DAYS = 182;

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Gli altri giorni (da oggi, sabato e domenica compresi) in cui un figlio ha
 * lo stesso impegno. `agendaFor` dà l'agenda di una data (buildTodayAgenda):
 * così valgono le stesse regole di ricorrenza e prenotazione dell'agenda.
 */
export function otherDatesOfPassage(input: {
  dateIso: string;
  todayIso: string;
  kidId: string;
  passageKey: string;
  /** Primo e ultimo giorno possibili dell'impegno (per non scorrere sei mesi a vuoto). */
  range: { startDate: string; endDate: string };
  agendaFor: (dateIso: string) => AgendaEntry[];
  horizonDays?: number;
}): string[] {
  const from = input.todayIso > input.range.startDate ? input.todayIso : input.range.startDate;
  const horizon = addDaysIso(input.todayIso, input.horizonDays ?? PASSAGE_APPLY_HORIZON_DAYS);
  const until = input.range.endDate < horizon ? input.range.endDate : horizon;
  const out: string[] = [];
  for (let d = from; d <= until; d = addDaysIso(d, 1)) {
    if (d === input.dateIso) continue;
    const isIt = (e: AgendaEntry) => (input.passageKey === SCHOOL_PASSAGE_KEY ? Boolean(e.school) : e.id === input.passageKey);
    if (input.agendaFor(d).some((e) => isIt(e) && e.kids.some((k) => k.id === input.kidId))) out.push(d);
  }
  return out;
}

/**
 * Cosa scrivere negli altri giorni: il passaggio scelto e, se quel giorno fa
 * parte di un viaggio (uscita da scuola → attività), anche l'altro pezzo del
 * viaggio; più la scelta del giorno quando è la prima andata o l'ultimo ritorno.
 */
export function applyAllTargets(input: {
  kidId: string;
  passageKey: string;
  moment: Moment;
  dates: string[];
  agendaFor: (dateIso: string) => AgendaEntry[];
}): { targets: PassageTarget[]; mirror: { kidId: string; date: string; moment: Moment }[] } {
  const targets: PassageTarget[] = [];
  const mirror: { kidId: string; date: string; moment: Moment }[] = [];
  for (const date of input.dates) {
    const legs = dayLegs(input.agendaFor(date), input.kidId);
    const mine = legs.find((l) => l.passageKey === input.passageKey && l.moment === input.moment);
    if (!mine) continue;
    const resolved = legs.map((l) => ({ ...l, label: null, source: null, row: null }));
    const trip = groupTrips(resolved).find((g) => g.kind === "trip" && (g.from.key === mine.key || g.to.key === mine.key));
    const chosen = trip && trip.kind === "trip" ? [trip.from, trip.to] : [mine];
    for (const l of chosen) {
      targets.push({ kidId: input.kidId, date, passageKey: l.passageKey, moment: l.moment });
      const day = dayMirrorFor(legs, l.key);
      if (day) mirror.push({ kidId: input.kidId, date, moment: day });
    }
  }
  return { targets, mirror };
}

/**
 * Chiave di una proposta "anche gli altri giorni" nel foglio Chi accompagna:
 * figlio + passaggi (27/10/2026). Senza il figlio, due figli con lo stesso
 * passaggio (es. entrata a scuola) condividevano la proposta e "Non ora".
 */
export function offerKeyFor(kidId: string, legs: { key: string }[]): string {
  return `${kidId}|${legs.map((l) => l.key).join("+")}`;
}
