// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Dal centro
// rendi apribile ciascuna attività, poi la singola giornata. Mostra capacità
// totale, posti occupati e disponibili, partecipanti confermati, prenotazioni
// collegate e storico delle variazioni". Iniziativa:
// claude/INIZIATIVA_admin_operativo.md.
//
// Collega le prenotazioni di un'attività ai suoi giorni e settimane e
// costruisce il libro di ogni giorno (lib/admin-ops/day-ledger.ts). Pura.

import type { AdminBookingRow } from "@/lib/admin-ops/bookings";
import { bookingRef } from "@/lib/admin-ops/bookings";
import { isDemoRecord } from "@/lib/admin-ops/demo";
import { buildDayLedger, type DayLedger, type LedgerGroupRequest, type LedgerRow } from "@/lib/admin-ops/day-ledger";

export interface CapacitySlot {
  id: string;
  capacity: number;
  spotsLeft: number;
}

/** Righe del libro per un giorno: una per prenotazione che lo contiene. */
export function ledgerRowsForDay(bookings: AdminBookingRow[], activityDayId: string): LedgerRow[] {
  const out: LedgerRow[] = [];
  for (const b of bookings) {
    const day = b.days.find((d) => d.activityDayId === activityDayId);
    if (!day) continue;
    out.push({
      bookingId: b.id,
      ref: bookingRef(b.id),
      bookingStatus: b.status,
      decision: day.decision,
      capacityDecremented: day.capacityDecremented,
      units: day.units,
      kidsCount: b.kidNames.length,
      label: `${b.parentName} · ${b.kidNames.join(", ") || "bambini non indicati"}`,
      isDemo: isDemoRecord({ centerName: b.centerName, centerIsTestFixture: b.centerIsTestFixture, activityName: b.activityName }),
    });
  }
  return out;
}

/** Righe del libro per una settimana (prenotazioni a settimana intera). */
export function ledgerRowsForWeek(bookings: AdminBookingRow[], weekId: string): LedgerRow[] {
  const out: LedgerRow[] = [];
  for (const b of bookings) {
    const w = b.weeks.find((x) => x.weekId === weekId);
    if (!w) continue;
    const accepted = b.status !== "cancelled" && b.partnerDecisionRaw === "accepted";
    out.push({
      bookingId: b.id,
      ref: bookingRef(b.id),
      bookingStatus: b.status,
      decision: accepted ? "accepted" : b.partnerDecisionRaw === "rejected" ? "rejected" : "pending",
      capacityDecremented: w.capacityDecremented,
      units: w.units,
      kidsCount: b.kidNames.length,
      label: `${b.parentName} · ${b.kidNames.join(", ") || "bambini non indicati"}`,
    });
  }
  return out;
}

export interface DaySummary {
  id: string;
  date: string;
  isOpen: boolean;
  ledger: DayLedger;
}

export function summarizeDays(
  days: (CapacitySlot & { date: string; isOpen: boolean })[],
  bookings: AdminBookingRow[],
  groupRequests: LedgerGroupRequest[] = []
): DaySummary[] {
  return days.map((d) => ({
    id: d.id,
    date: d.date,
    isOpen: d.isOpen,
    ledger: buildDayLedger({ capacity: d.capacity, spotsLeft: d.spotsLeft }, ledgerRowsForDay(bookings, d.id), groupRequests),
  }));
}
