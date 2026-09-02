import { Moment, MOMENTS } from "@/lib/nextgen/responsibility-options";

// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 8-13).
//
// ROOT CAUSE ANALYSIS (bulk assign "Andata" appare barrato al tap):
// verificata leggendo PlannerCalendarView.tsx PRIMA di scrivere qualunque
// fix — non era solo un bug visivo, la logica stessa era di ESCLUSIONE:
// bulkMomentExcluded partiva vuoto (= "tutto incluso di default", sia Andata
// che Ritorno applicati SENZA bisogno di toccare nulla) e il tap
// AGGIUNGEVA quel momento alle esclusioni, mostrato con line-through — cioè
// "tocca Andata" significava letteralmente "escludi Andata dall'azione",
// l'opposto di quello che il genitore si aspetta toccando un'etichetta
// "Andata" (includerla). Il modello ad esclusione ha senso per i BAMBINI
// (default "gestiti insieme", tap per escludere il singolo figlio — non
// segnalato come confuso, resta invariato) ma non per Andata/Ritorno, dove
// il genitore ragiona in termini di "cosa voglio applicare adesso", non "cosa
// voglio escludere da un tutto già implicito".
//
// Fix: modello a SELEZIONE POSITIVA per i momenti (Andata/Ritorno) — nessuno
// selezionato di default, tap per selezionare/deselezionare, nessun
// line-through (selezionato ≠ escluso, è l'opposto: selezionato = incluso).
// Se nessun momento è selezionato, l'assegnazione a una persona è disabilitata
// (bottoni "disabled", niente azione ambigua silenziosa) — vedi
// PlannerCalendarView.tsx per il collegamento a bulkBusy/hint.
//
// Logica pura estratta qui (stesso principio già usato in questa sessione per
// responsibility-tone.ts/planner-insights.ts/build-entries.ts/
// groups-back-nav.ts): testabile senza browser — vedi
// tests/nextgen/bulk-assign.spec.ts (BULK-01..09).

export type ToggleMap<T extends string> = Partial<Record<T, boolean>>;

// Toggle generico (stesso identico pattern già in uso per bulkKidExcluded, la
// cui semantica ad esclusione resta invariata — vedi commento sopra): tap
// inverte lo stato booleano associato alla chiave.
export function toggleInMap<T extends string>(prev: ToggleMap<T>, key: T): ToggleMap<T> {
  return { ...prev, [key]: !prev[key] };
}

// Momenti (Andata/Ritorno, in ordine) attualmente SELEZIONATI — modello
// positivo: selected[value] === true significa "verrà applicato".
export function selectedMoments(selected: ToggleMap<Moment>): Moment[] {
  return MOMENTS.map((m) => m.value).filter((v) => selected[v] === true);
}

// L'assegnazione a una persona è ambigua (e quindi disabilitata) finché
// nessun momento è selezionato — punto 12: "non eseguire un'assegnazione
// ambigua".
export function isBulkAssignReady(selected: ToggleMap<Moment>): boolean {
  return selectedMoments(selected).length > 0;
}
