// PLANNER BETA v1.1 (Wave 2) — "Organizzazione Andata/Ritorno" nel Dettaglio
// Settimana: quanti passaggi (accompagnamento/ritiro) servono davvero questa
// settimana e quanti sono già assegnati in "Chi fa cosa?" (week_responsibilities).
//
// Formula concettuale (dalla revisione approvata):
//   SUM( REAL BOOKED CHILD-DAYS × {ANDATA, RITORNO} ) − ASSIGNED RESPONSIBILITIES
//   = ROLES TO COVER
//
// Regole vincolanti:
// - Il calcolo è per singolo bambino (kid_id + weekday/date + moment), MAI una
//   formula generica "5 giorni × numero bambini coperti": ogni bambino porta
//   solo i giorni per cui esiste una prenotazione REALE (vedi
//   lib/data/responsibilities.ts#getKidsBookedDaysForWeek — stessa fonte già
//   usata per "Chi fa cosa?" oggi, nessuna nuova interpretazione del
//   calendario).
// - Un martedì condiviso da due bambini genera 4 slot distinti (Sofia
//   Andata/Ritorno + Niccolò Andata/Ritorno), mai deduplicati a livello
//   famiglia: la chiave include sempre kidId.
// - Multi-attività stesso bambino/stesso giorno: week_responsibilities è
//   chiave per (kid, settimana, weekday, moment), NON per singola occorrenza
//   di attività — non può quindi distinguere due Andate diverse per lo
//   stesso bambino nello stesso giorno. getKidsBookedDaysForWeek già
//   deduplica per (kid, giorno) a monte (Set di date), quindi qui non si
//   generano mai più di 1 Andata + 1 Ritorno per kid_id+giorno.
//   CURRENT DOMAIN LIMITATION — ACTIVITY-LEVEL TRANSPORT NOT MODELED.
//   Nessuna migration per risolverlo in questa fase.

import { WEEKDAYS, MOMENTS, Weekday, Moment, WeekResponsibility } from "./responsibility-options";

export interface KidBookedDaysInput {
  kidId: string;
  kidName: string;
  dates: string[]; // ISO, sottoinsieme dei 5 giorni feriali della settimana
}

export interface RoleSlot {
  kidId: string;
  kidName: string;
  date: string;
  weekday: Weekday;
  moment: Moment;
}

export interface RolesToCoverSummary {
  // true solo se esiste almeno un child-day realmente prenotato questa
  // settimana — il blocco "Organizzazione" non va mostrato affatto quando è
  // false (nessuna prenotazione = nessun passaggio da organizzare).
  hasBookedDays: boolean;
  totalSlots: number;
  assignedSlots: number;
  missingSlots: number;
  byMoment: Record<Moment, { assigned: number; missing: number }>;
  missing: RoleSlot[];
}

// Stessa tecnica di addDaysIso duplicata altrove nel repo (piccola funzione
// pura, vedi components/nextgen/PlannerCalendarView.tsx) — converte
// l'offset in giorni di WEEKDAYS in una data ISO reale a partire dal lunedì
// della settimana.
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeRolesToCover(
  weekStartDate: string,
  bookedDays: KidBookedDaysInput[],
  responsibilities: WeekResponsibility[]
): RolesToCoverSummary {
  const weekdayByDate = new Map<string, Weekday>();
  for (const wd of WEEKDAYS) {
    weekdayByDate.set(addDaysIso(weekStartDate, wd.dayOffset), wd.value);
  }

  const assignedKeys = new Set(
    responsibilities
      .filter((r) => r.weekStartDate === weekStartDate)
      .map((r) => `${r.kidId}__${r.weekday}__${r.moment}`)
  );

  const byMoment: Record<Moment, { assigned: number; missing: number }> = {
    andata: { assigned: 0, missing: 0 },
    ritorno: { assigned: 0, missing: 0 },
  };
  const missing: RoleSlot[] = [];
  let totalSlots = 0;
  let assignedSlots = 0;

  for (const kid of bookedDays) {
    for (const dateIso of kid.dates) {
      const weekday = weekdayByDate.get(dateIso);
      if (!weekday) continue; // data fuori dai 5 giorni feriali di questa settimana
      for (const mo of MOMENTS) {
        totalSlots += 1;
        const key = `${kid.kidId}__${weekday}__${mo.value}`;
        if (assignedKeys.has(key)) {
          assignedSlots += 1;
          byMoment[mo.value].assigned += 1;
        } else {
          byMoment[mo.value].missing += 1;
          missing.push({ kidId: kid.kidId, kidName: kid.kidName, date: dateIso, weekday, moment: mo.value });
        }
      }
    }
  }

  return {
    hasBookedDays: bookedDays.some((k) => k.dates.length > 0),
    totalSlots,
    assignedSlots,
    missingSlots: totalSlots - assignedSlots,
    byMoment,
    missing,
  };
}

// TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (02/09/2026): finora
// computeRolesToCover veniva chiamato una sola volta, per UNA settimana
// (Dettaglio Settimana). Serve ora lo STESSO identico calcolo aggregato su
// PIÙ settimane (future/rilevanti) per Home e Planner Overview — così si
// può distinguere "copertura ATTIVITÀ" (ha una prenotazione? già gestito da
// planner.covered / computeHeroWeeksSummary, INVARIATI) da "copertura
// COORDINAMENTO" (per ogni child-day prenotato, sappiamo chi fa Andata e chi
// fa Ritorno?). Deliberatamente NIENTE nuova formula: computeCoordinationGap
// è solo un loop che richiama computeRolesToCover una volta per settimana
// futura rilevante, riusando lo stesso "bookedDays" passato per intero (la
// funzione già ignora da sola le date fuori dai 5 giorni feriali della
// settimana in esame, vedi "weekdayByDate.get(dateIso) ?? continue" sopra) —
// nessuna nuova query, nessun secondo calcolo divergente.
//
// Perimetro "futuro/rilevante" IDENTICO a computeHeroWeeksSummary (lib/
// nextgen/planner-insights.ts, "FINAL HERO SEMANTIC FIX", non toccato):
// !dismissed && endDate >= todayIso — stessa convenzione di date già usata
// da upcomingWeeks/priorityWeek, nessuna nuova interpretazione del
// calendario/timezone.
export interface CoordinationGapSummary {
  // Somma di missingSlots su tutte le settimane future rilevanti — "quanti
  // passaggi Andata/Ritorno mancano da assegnare, in totale, da qui in poi".
  totalMissing: number;
  // Prima settimana futura rilevante con almeno 1 slot mancante (per il
  // deep-link "Settimana N" — §8/§9 del prompt), null se nessun gap.
  firstGapWeekStartDate: string | null;
  firstGapWeekIndex: number | null;
  // Unione di tutti gli slot mancanti, per eventuale dettaglio futuro (non
  // usato direttamente dalla UI di questa wave, ma utile per i test).
  missing: RoleSlot[];
}

export function computeCoordinationGap(
  weeks: { index: number; startDate: string; dismissed: boolean; endDate: string }[],
  bookedDays: KidBookedDaysInput[],
  responsibilities: WeekResponsibility[],
  todayIso: string
): CoordinationGapSummary {
  const futureRelevant = weeks
    .filter((w) => !w.dismissed && w.endDate >= todayIso)
    .sort((a, b) => a.index - b.index);

  let totalMissing = 0;
  let firstGapWeekStartDate: string | null = null;
  let firstGapWeekIndex: number | null = null;
  const missing: RoleSlot[] = [];

  for (const week of futureRelevant) {
    const summary = computeRolesToCover(week.startDate, bookedDays, responsibilities);
    if (summary.missingSlots > 0) {
      totalMissing += summary.missingSlots;
      missing.push(...summary.missing);
      if (firstGapWeekStartDate === null) {
        firstGapWeekStartDate = week.startDate;
        firstGapWeekIndex = week.index;
      }
    }
  }

  return { totalMissing, firstGapWeekStartDate, firstGapWeekIndex, missing };
}

// TRAMA BETA v1.1.1 — regola formale di "ORGANIZZAZIONE COMPLETA" (§10 del
// prompt): completa SOLO se copertura ATTIVITÀ (dato esistente, calcolato da
// Home/Planner con la loro rispettiva logica invariata) E copertura
// COORDINAMENTO (missingCoordinationCount, da computeCoordinationGap sopra)
// sono ENTRAMBE vere. L'attività ha sempre priorità: se manca la copertura
// attività, lo stato è "activity_gap" a prescindere dal coordinamento (un
// gap di coordinamento non deve mai mascherare un problema di attività più
// fondamentale — §6 CASO C).
export type OrganizationState = "full" | "coordination_gap" | "activity_gap";

export function computeOrganizationState(
  activityCoverageComplete: boolean,
  missingCoordinationCount: number
): OrganizationState {
  if (!activityCoverageComplete) return "activity_gap";
  if (missingCoordinationCount > 0) return "coordination_gap";
  return "full";
}
