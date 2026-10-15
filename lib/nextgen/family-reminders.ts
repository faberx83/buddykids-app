// TRAMA — PROMEMORIA SERALI PER LE FAMIGLIE (15/10/2026). Fabrizio: "ragionerei
// se nella lista eventi va aggiunto altro". Le notifiche esistenti coprono
// prenotazioni, gruppi, messaggi col centro, check-in e partenza: tutte legate
// alle attività prenotate (in pratica, all'estate). Mancavano i due momenti in
// cui TRAMA serve di più durante l'anno scolastico:
//   1. "Domani manca chi accompagna" — Porta/Ritira di domani non assegnato
//      (stessa regola del Planner V2: prenotazioni + impegni a mano, lun–ven);
//   2. "Scuola chiusa tra una settimana / dopodomani" — una chiusura (ponte,
//      vacanza) non ancora organizzata per qualche figlio.
// Logica pura (nessuna query): i dati arrivano da lib/data/family-reminders.ts.
// Al massimo UNA notifica per tipo per sera; testi brevi, senza emoji.

import { addDaysIso, dayCoordinationSlots, mondayOfIso } from "@/lib/nextgen/planner-week";
import { closureRangeLabel, type ClosurePeriod, type CoverageEntry } from "@/lib/nextgen/holiday-summary";
import type { WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { AgendaBookingInput, AgendaExternalInput } from "@/lib/nextgen/today-agenda";

export interface FamilyReminder {
  kind: "coordination_tomorrow" | "closure_soon";
  title: string;
  body: string;
  deepLink: string;
}

/** Giorni di anticipo per l'avviso di chiusura: una settimana prima e dopodomani. */
export const CLOSURE_REMINDER_DAYS = [7, 2] as const;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function buildFamilyReminders(input: {
  todayIso: string;
  bookings: Pick<AgendaBookingInput, "status" | "kidIds" | "kidNames" | "weeks" | "dayDates">[];
  externalItems: Pick<AgendaExternalInput, "startDate" | "endDate" | "kidIds">[];
  responsibilities: WeekResponsibility[];
  kidNameById: Record<string, string>;
  labelFor: (r: WeekResponsibility) => string;
  closurePeriods: ClosurePeriod[];
  coverage: CoverageEntry[];
}): FamilyReminder[] {
  const out: FamilyReminder[] = [];

  // 1. Domani: Porta/Ritira mancanti
  const tomorrow = addDaysIso(input.todayIso, 1);
  const missing = dayCoordinationSlots({
    dateIso: tomorrow,
    bookings: input.bookings,
    externalItems: input.externalItems,
    responsibilities: input.responsibilities,
    kidNameById: input.kidNameById,
    labelFor: input.labelFor,
  }).filter((s) => s.label === null);
  if (missing.length > 0) {
    const body =
      missing.length === 1
        ? `Manca chi ${missing[0].moment === "andata" ? "porta" : "ritira"} ${missing[0].kidName}.`
        : `Mancano ${missing.length} passaggi per ${joinNames(Array.from(new Set(missing.map((m) => m.kidName))))}.`;
    out.push({
      kind: "coordination_tomorrow",
      title: "Domani: chi accompagna?",
      body,
      deepLink: `/nextgen/planner?week=${mondayOfIso(tomorrow)}&panel=chi`,
    });
  }

  // 2. Chiusura scolastica tra 7 giorni o dopodomani, non organizzata per qualcuno
  for (const days of CLOSURE_REMINDER_DAYS) {
    const start = addDaysIso(input.todayIso, days);
    const period = input.closurePeriods.find((p) => p.startDate === start);
    if (!period) continue;
    const uncovered = period.kidIds.filter((kidId) =>
      (period.weekdaysByKid[kidId] ?? []).some(
        (day) => !input.coverage.some((c) => (c.kidIds.length === 0 || c.kidIds.includes(kidId)) && c.dates.includes(day))
      )
    );
    const names = uncovered.map((id) => input.kidNameById[id]).filter(Boolean);
    if (names.length === 0) continue;
    const when = days === 7 ? "tra una settimana" : "dopodomani";
    const what = period.labels[0] ? `${period.labels[0]}, ${closureRangeLabel(period.startDate, period.endDate)}` : closureRangeLabel(period.startDate, period.endDate);
    out.push({
      kind: "closure_soon",
      title: `Scuola chiusa ${when}`,
      body: `${what}: per ${joinNames(names)} non c'è ancora niente.`,
      deepLink: `/nextgen/planner?week=${mondayOfIso(period.startDate)}`,
    });
    break; // una sola notifica di chiusura per sera
  }

  return out;
}
