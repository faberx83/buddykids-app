// TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE
// (28/09/2026, richiesta di Fabrizio dopo aver mostrato uno screenshot di
// riferimento — un mockup "Calendario prenotazioni" NON di TRAMA, solo
// ispirazione per il pattern visivo "day strip + agenda cronologica").
//
// Logica PURA (nessuna dipendenza React/server) estratta da
// components/nextgen/PlannerCalendarView.tsx per essere coperta da test
// unitari indipendenti dal browser — stessa tecnica già in uso per
// lib/nextgen/bulk-assign.ts, lib/nextgen/responsibility-tone.ts e
// lib/nextgen/calendar-weeks.ts (vedi commenti in quei file per la
// convenzione "[no browser]" di questo repo).
//
// Questo modulo NON tocca in alcun modo covered/dismissed/coveredKids —
// legge solo un CalendarDay già calcolato a monte da
// lib/nextgen/calendar-weeks.ts (buildCalendarMonths/dayFromWeek), stesso
// principio "presentation layer, non business logic" del task che ha
// introdotto la vista Agenda.

import type { CalendarDay } from "@/lib/nextgen/calendar-weeks";
import type { ExternalCalendarOccurrence } from "@/lib/planner/external-calendar-items-core";

// Day strip — etichette a 3 lettere (target "LUN 14" del mockup di
// riferimento), indicizzate 0=Lun..6=Dom.
export const WEEKDAY_SHORT3_IT = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

// Card cronologica: bordo sinistro pieno + sfondo tenue coordinato per
// bambino (stessa mappatura colore di DOT_BG/accentColor in
// PlannerCalendarView.tsx, solo un trattamento visivo diverso: bordo pieno
// invece di un pallino). Classi COMPLETE e STATICHE (mai `border-${x}`
// dinamico): Tailwind (JIT) deve vedere la stringa letterale nel sorgente
// per generarla, un template string a runtime verrebbe silenziosamente
// scartato al build.
export const AGENDA_BORDER_BG: Record<string, string> = {
  sky: "border-sky bg-sky/10",
  aqua: "border-aqua bg-aqua/10",
  orange: "border-orange bg-orange/10",
  purple: "border-purple bg-purple/10",
  green: "border-green bg-green/10",
};
// Impegni esterni — MAI lo stesso linguaggio visivo di un booking TRAMA:
// violetto TRAMA fisso, indipendente dal bambino, coerente con l'unico
// colore già usato per "Esterno" nella legenda e nella cella mese.
export const AGENDA_EXTERNAL_BORDER_BG = "border-trama-violet bg-trama-violet/10";

// Day strip — lunedì della settimana ISO che contiene `iso`. Stessa tecnica
// addDaysIso/getUTCDay già in uso in tutto il repo (0=Dom..6=Sab →
// 0=Lun..6=Dom).
export function mondayOfIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Day strip — 7 date (Lun..Dom) della settimana che contiene `iso`.
export function agendaWeekDates(iso: string): string[] {
  const monday = mondayOfIso(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

export function formatMonthYearIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const label = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Riga unificata (booking TRAMA coperto O impegno esterno) per il giorno
// selezionato: STESSO principio "domini separati, presentation layer
// unificato" già documentato per VISIBILE ≠ COVERED (sezione 1 del task
// External Planner Items in lib/nextgen/calendar-weeks.ts e
// lib/planner/external-calendar-items-core.ts) — una singola lista
// cronologica, la provenienza resta distinguibile SOLO dal badge/colore
// della card, mai da sezioni separate. Nessun calcolo qui: legge solo
// cell.covered/cell.dismissed/cell.kids/cell.externalItems, già calcolati a
// monte da buildCalendarMonths/dayFromWeek — zero logica di coverage
// duplicata o reinterpretata.
export type AgendaRow =
  | {
      kind: "trama";
      kidId: string;
      kidName: string;
      accentColor: string;
      title: string;
      // WEEK VIEW V2 (29/09/2026) — vedi CalendarDayKid.categoryLabel/
      // categoryEmoji in lib/nextgen/calendar-weeks.ts: dato reale (primo tag
      // dell'attività), mai inferito dal titolo. undefined = nessun tag
      // assegnato (fallback neutro, sezione 11 del brief).
      categoryLabel?: string;
      categoryEmoji?: string;
    }
  | { kind: "external"; occ: ExternalCalendarOccurrence };

export function buildAgendaRows(cell: CalendarDay): AgendaRow[] {
  const rows: AgendaRow[] = [];
  if (cell.covered && !cell.dismissed) {
    for (const k of cell.kids) {
      rows.push({
        kind: "trama",
        kidId: k.kidId,
        kidName: k.kidName,
        accentColor: k.accentColor,
        title: cell.activityName ?? "Attività prenotata",
        categoryLabel: k.categoryLabel,
        categoryEmoji: k.categoryEmoji,
      });
    }
  }
  // I booking TRAMA non hanno un orario reale (limite dati dichiarato in
  // lib/nextgen/calendar-weeks.ts — nessuna granularità oraria, solo
  // settimana intera) — trattati come "tutto il giorno" ai fini
  // dell'ordinamento, quindi vengono prima; gli impegni esterni "tutto il
  // giorno" seguono, poi quelli con orario in ordine crescente (stessa
  // convenzione già usata per selectedDay.externalItems in
  // PlannerCalendarView.tsx).
  const sortedExternal = [...cell.externalItems].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
  for (const occ of sortedExternal) rows.push({ kind: "external", occ });
  return rows;
}
