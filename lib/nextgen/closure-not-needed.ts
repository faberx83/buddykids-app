// TRAMA — "NON SERVE" SULLE CHIUSURE DELLA SCUOLA (20/10/2026).
// Fabrizio: "su Lino non ho una CTA per segnare come non necessario o per
// fargli fare qualcosa". Il genitore può dire, per un figlio e una
// settimana, che nei giorni di scuola chiusa non serve organizzare niente
// (resta a casa, ci sono i nonni…). Riusa la tabella che esiste già per la
// stessa scelta sulle settimane senza scuola: school_calendar_overrides
// (migration_26, override_type = "not_needed", un figlio, una settimana).
// Nessuna tabella nuova.
//
// Regola: un "non serve" vale come copertura dei giorni feriali di quella
// settimana per quel figlio. Così lo rispettano da soli, senza logica a
// parte: l'avviso della Settimana (uncoveredClosureDays), "Chiusure della
// scuola" (closureState), la Home e il promemoria della sera.

import type { CoverageEntry } from "@/lib/nextgen/holiday-summary";

export interface ClosureNotNeeded {
  kidId: string;
  /** Lunedì della settimana (YYYY-MM-DD). */
  weekStartDate: string;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lun–ven della settimana che inizia di lunedì. */
export function weekdaysOfWeek(mondayIso: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDaysIso(mondayIso, i));
}

/** I "non serve" come voci di copertura (stessa forma di bookings ed impegni). */
export function notNeededCoverage(rows: ClosureNotNeeded[]): CoverageEntry[] {
  return rows.map((r) => ({ kidIds: [r.kidId], dates: weekdaysOfWeek(r.weekStartDate) }));
}

export function notNeededKey(kidId: string, weekStartDate: string): string {
  return `${kidId}|${weekStartDate}`;
}
