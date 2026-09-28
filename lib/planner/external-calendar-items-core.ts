// TRAMA — EXTERNAL PLANNER ITEMS · VISIBILITÀ NEL CALENDARIO (live UX fix,
// 28/09/2026).
//
// ROOT CAUSE del problema live ("gli External Planner Items non si vedono
// nel calendario") — verificata leggendo per intero PlannerCalendarView.tsx,
// PlannerClient.tsx e lib/nextgen/calendar-weeks.ts PRIMA di scrivere questo
// file, come richiesto: la vista Calendario del Planner (PlannerCalendarView)
// è costruita ESCLUSIVAMENTE a partire da SeasonWeek (buildCalendarMonths in
// lib/nextgen/calendar-weeks.ts). PlannerClient.tsx riceve già
// externalPlannerItems come prop (usata SOLO da <ExternalPlannerItemsSection>,
// la lista "I tuoi impegni"), ma non la passava affatto a
// <PlannerCalendarView>, che quindi non aveva alcun modo di saperli. Non è un
// bug di query/filtro/feature flag: i dati esistono, sono corretti e già
// letti server-side — semplicemente non arrivavano mai al componente
// calendario. lib/planner/calendar-items-core.ts (motore "Calendar Export"
// ICS) NON è coinvolto: quel modulo alimenta solo l'export .ics
// (PlannerCalendarExportCard), non la vista calendario visuale.
//
// Questo modulo è logica pura (nessun I/O, nessun "use client"/"server-only")
// — espande ogni ExternalPlannerItem nel range [startDate, endDate]
// INCLUSIVO in singole "occorrenze per giorno", SENZA creare alcuna riga DB
// per giorno: il range resta un'unica riga in external_planner_items,
// l'espansione avviene solo qui, in memoria, per popolare la griglia
// calendario (stessa tecnica già in uso per weekByDate in calendar-weeks.ts,
// che espande le SeasonWeek Lun-Ven allo stesso modo).
//
// COVERAGE-NEUTRALE PER COSTRUZIONE (regola critica della sezione 1 del
// task): questo modulo non legge né scrive mai
// SeasonWeek.covered/dismissed/WeekStatus/School Calendar need/Activity
// Coverage/Coordination Coverage — produce solo un Map<dateIso, occorrenze[]>
// usato per DECORARE la UI del calendario, mai per calcolare copertura.
// Stessa garanzia già documentata lato data layer in
// lib/data/external-planner-items.ts (coverage_behavior sempre 'none').

import type { ExternalPlannerItem } from "@/lib/data/external-planner-items";
import type { Kid } from "@/lib/types";

export interface ExternalCalendarOccurrence {
  itemId: string;
  dateIso: string;
  title: string;
  kind: "activity" | "commitment";
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  kidNames: string[];
  sourceType: "manual" | "curated_discovery";
  // Multi-day rendering (sezione 2 del task): serve a decidere se mostrare
  // "inizia oggi"/"continua"/"finisce oggi" in un'agenda, senza dover
  // ricalcolare il range originale a partire dalla sola occorrenza del
  // giorno.
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Guardia contro range corrotti/assurdamente lunghi — stesso principio
// difensivo del guard<14 già in uso in weekByDate (calendar-weeks.ts), qui
// più alto perché un range legittimo (es. un centro estivo di più settimane)
// può superare i 14 giorni: 400 giorni coprono comunque oltre una stagione
// intera, un limite di sicurezza mai raggiunto da un impegno reale.
const MAX_OCCURRENCE_DAYS = 400;

// Espande TUTTI gli item (già filtrati soft-delete a monte, vedi
// getExternalPlannerItemsForParent — .is("deleted_at", null)) in una mappa
// data→occorrenze. Un giorno con più impegni ha semplicemente più di
// un'occorrenza nello stesso array (sezione 2: "più item nello stesso
// giorno" — nessuna deduplicazione, nessun limite qui).
export function buildExternalOccurrencesByDate(
  items: ExternalPlannerItem[],
  kids: Kid[]
): Map<string, ExternalCalendarOccurrence[]> {
  const kidNameById = new Map(kids.map((k) => [k.id, k.name]));
  const byDate = new Map<string, ExternalCalendarOccurrence[]>();

  for (const item of items) {
    const kidNames = item.kidIds
      .map((id) => kidNameById.get(id))
      .filter((n): n is string => Boolean(n));

    let cursor = item.startDate;
    let guard = 0;
    // Range INCLUSIVO: start_date <= day <= end_date (sezione 2 del task).
    // one-day (start===end) produce esattamente un'occorrenza, un range
    // multi-day ne produce una per ciascun giorno incluso, month/week
    // boundary comprese (questo modulo non sa nulla di mesi/settimane, si
    // limita a popolare la mappa: è buildCalendarMonths, sotto, a smistare
    // ogni occorrenza nella cella/mese giusto).
    while (cursor <= item.endDate && guard < MAX_OCCURRENCE_DAYS) {
      const occurrence: ExternalCalendarOccurrence = {
        itemId: item.id,
        dateIso: cursor,
        title: item.title,
        kind: item.kind,
        allDay: item.allDay,
        startTime: item.startTime,
        endTime: item.endTime,
        kidNames,
        sourceType: item.sourceType,
        isRangeStart: cursor === item.startDate,
        isRangeEnd: cursor === item.endDate,
      };
      const list = byDate.get(cursor) ?? [];
      list.push(occurrence);
      byDate.set(cursor, list);
      cursor = addDaysIso(cursor, 1);
      guard += 1;
    }
  }

  return byDate;
}

// Aggrega le occorrenze di un intervallo [startDate, endDate] inclusivo —
// usata dalla vista "Settimana" del Calendario (che seleziona un'intera
// SeasonWeek, non un singolo giorno): ogni occorrenza porta comunque il
// proprio dateIso esatto, cosi l'agenda può comunque mostrare "quale giorno
// della settimana" anche in quella vista.
export function externalOccurrencesInRange(
  byDate: Map<string, ExternalCalendarOccurrence[]>,
  startDate: string,
  endDate: string
): ExternalCalendarOccurrence[] {
  const result: ExternalCalendarOccurrence[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < MAX_OCCURRENCE_DAYS) {
    const occurrences = byDate.get(cursor);
    if (occurrences) result.push(...occurrences);
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  return result;
}
