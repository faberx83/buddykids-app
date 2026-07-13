// SPRINT 5.2 (NEXTGEN) — Planner, modalità Calendario: "Giorno, settimana e
// mese, con colori per figlio e conflitti evidenziati" (PRD Family Planner).
//
// LIMITE DI DATI DICHIARATO (verificato prima di scrivere questo modulo): il
// modello dati NON ha alcuna granularità giornaliera reale — le prenotazioni
// coprono intere settimane stagionali (Lun-Ven), non singoli giorni di
// frequenza (niente activity_weeks.day_of_week, niente booking_days). Una
// vera "vista Giorno" con presenza per singolo giorno non è quindi
// costruibile oggi: questo modulo espande le SeasonWeek (già calcolate da
// lib/data/planner.ts, invariato) nei giorni feriali che compongono ciascuna
// settimana, per popolare una griglia di calendario mensile — nessuna nuova
// query al DB, nessun dato finto: i weekend restano sempre vuoti perché i
// centri operano Lun-Ven.

import { SeasonWeek } from "@/lib/data/planner";
import { KidOverlap } from "@/lib/nextgen/planner-insights";
import { Kid, PillColor } from "@/lib/types";

export interface CalendarDayKid {
  kidId: string;
  kidName: string;
  accentColor: PillColor;
}

export interface CalendarDay {
  dateIso: string;
  dayOfMonth: number;
  weekIndex: number | null;
  weekLabel: string | null;
  inSeason: boolean;
  covered: boolean;
  dismissed: boolean;
  activityName?: string;
  kids: CalendarDayKid[];
  hasConflict: boolean;
}

export interface CalendarMonth {
  key: string; // "yyyy-mm"
  label: string; // "Giugno 2026"
  cells: (CalendarDay | null)[]; // lunghezza multipla di 7 (Lun..Dom); null = riempimento
}

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Stessa palette/tecnica hash di lib/data/kids.ts (accentColorForName),
// duplicata di proposito: quel file importa createClient (Supabase server)
// e non va importato da un componente client (stessa convenzione già usata
// in lib/nextgen/missions.ts per normalizeKeyword).
const ACCENT_PALETTE: PillColor[] = ["sky", "aqua", "orange", "purple", "green"];
function accentColorForKid(kid: Kid): PillColor {
  if (kid.accentColor) return kid.accentColor;
  let hash = 0;
  for (let i = 0; i < kid.name.length; i++) hash = (hash * 37 + kid.name.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

// Stesso parsing di PlannerClient.tsx (weekIndexFromLabel): le sovrapposizioni
// (KidOverlap) portano un weekLabel già normalizzato a "Settimana N" da
// lib/data/my-bookings.ts (canonicalLabel), quindi il numero estratto
// corrisponde sempre all'indice della SeasonWeek.
function weekIndexFromLabel(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoOfDate(d);
}

function isoOfDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildCalendarMonths(
  weeks: SeasonWeek[],
  kids: Kid[],
  overlaps: KidOverlap[]
): CalendarMonth[] {
  if (weeks.length === 0) return [];

  const kidById = new Map(kids.map((k) => [k.id, k]));
  const conflictWeekIndexes = new Set(
    overlaps.map((o) => weekIndexFromLabel(o.weekLabel)).filter((i): i is number => i !== null)
  );

  // Ogni SeasonWeek copre un range Lun-Ven: mappiamo ogni data del range alla
  // sua settimana, cosi possiamo popolare una griglia mese-per-mese senza
  // ricalcolare nulla di data-sensitive qui (le date vengono da
  // getSeasonWeekRanges, invariato).
  const weekByDate = new Map<string, SeasonWeek>();
  for (const w of weeks) {
    let cursor = w.startDate;
    let guard = 0;
    while (cursor <= w.endDate && guard < 14) {
      weekByDate.set(cursor, w);
      cursor = addDaysIso(cursor, 1);
      guard += 1;
    }
  }

  const firstDate = new Date(weeks[0].startDate + "T00:00:00Z");
  const lastDate = new Date(weeks[weeks.length - 1].endDate + "T00:00:00Z");

  const months: CalendarMonth[] = [];
  let cursorYear = firstDate.getUTCFullYear();
  let cursorMonth = firstDate.getUTCMonth(); // 0-based
  const endYear = lastDate.getUTCFullYear();
  const endMonth = lastDate.getUTCMonth();

  let guardMonths = 0;
  while ((cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonth)) && guardMonths < 24) {
    guardMonths += 1;
    const daysInMonth = new Date(Date.UTC(cursorYear, cursorMonth + 1, 0)).getUTCDate();
    const firstOfMonthWeekday = new Date(Date.UTC(cursorYear, cursorMonth, 1)).getUTCDay();
    // Griglia Lun-Dom: JS getUTCDay() è 0=Dom..6=Sab, la convertiamo a 0=Lun..6=Dom.
    const leadingBlanks = (firstOfMonthWeekday + 6) % 7;

    const cells: (CalendarDay | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = isoOfDate(new Date(Date.UTC(cursorYear, cursorMonth, day)));
      const seasonWeek = weekByDate.get(dateIso);

      if (!seasonWeek) {
        cells.push({
          dateIso,
          dayOfMonth: day,
          weekIndex: null,
          weekLabel: null,
          inSeason: false,
          covered: false,
          dismissed: false,
          kids: [],
          hasConflict: false,
        });
        continue;
      }

      const dayKids: CalendarDayKid[] = seasonWeek.coveredKids
        .map((ck) => kidById.get(ck.kidId))
        .filter((k): k is Kid => Boolean(k))
        .map((k) => ({ kidId: k.id, kidName: k.name, accentColor: accentColorForKid(k) }));

      cells.push({
        dateIso,
        dayOfMonth: day,
        weekIndex: seasonWeek.index,
        weekLabel: seasonWeek.label,
        inSeason: true,
        covered: seasonWeek.covered,
        dismissed: seasonWeek.dismissed,
        activityName: seasonWeek.activityName,
        kids: dayKids,
        hasConflict: conflictWeekIndexes.has(seasonWeek.index),
      });
    }

    while (cells.length % 7 !== 0) cells.push(null);

    months.push({
      key: `${cursorYear}-${String(cursorMonth + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS_IT[cursorMonth]} ${cursorYear}`,
      cells,
    });

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return months;
}

// Mese "di default" da mostrare all'apertura: quello di oggi se rientra nella
// stagione, altrimenti il primo mese della stagione (evita di aprire il
// Calendario su un mese vuoto per chi guarda a stagione non ancora iniziata).
export function defaultMonthKey(months: CalendarMonth[], todayIso: string): string {
  if (months.length === 0) return "";
  const todayKey = todayIso.slice(0, 7);
  const match = months.find((m) => m.key === todayKey);
  return (match ?? months[0]).key;
}
