// TRAMA ONE Build Sprint 6 — servizio canonico di Capacity (backlog
// vincolante P1, SPRINT_GOVERNANCE.md, inserito in sede di Evidence Patch —
// vedi AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md §16.6 e
// CORE_DOMAIN_SOURCE_OF_TRUTH.md §5 per la diagnosi originale).
//
// Prima di questo file, tre `UPDATE` sparsi in app/actions/booking-response.ts
// e app/actions/bookings.ts leggevano e scrivevano `activity_weeks.spots_left`
// / `activity_days.spots_left` ciascuno con la propria logica leggermente
// diversa (uno senza flag di idempotenza dedicato). Questo modulo unifica
// reservation/release in UN solo punto per tabella, con invarianti esplicite
// verificate PRIMA di ogni scrittura:
//   1. spots_left non scende mai sotto 0.
//   2. spots_left non supera mai `capacity` (il rilascio è sempre "clampato").
// Nessun calcolo economico qui: questo file NON tocca `activities.spots_left`
// (il campo "editoriale" descritto in CORE_DOMAIN_SOURCE_OF_TRUTH.md §5) —
// derivarlo da qui resta la raccomandazione non bloccante già registrata in
// quel documento, esplicitamente rinviata a un futuro sprint (DEC-47).

import { createClient } from "@/lib/supabase/server";
import { logTelemetryEvent } from "@/lib/telemetry/correlation";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

export interface CapacityMutationResult {
  /** true se la mutazione ha avuto effetto (reserve riuscita / release riuscita). */
  applied: boolean;
  /** Valore di spots_left DOPO la mutazione (o quello attuale se applied=false). */
  spotsLeft: number;
}

/** Invariante pura, senza I/O: mai sotto 0, mai sopra capacity. Esportata per essere testata isolatamente. */
export function clampSpotsLeft(value: number, capacity: number): number {
  if (capacity < 0) capacity = 0;
  return Math.min(Math.max(value, 0), capacity);
}

async function reserveSpot(
  supabase: SupabaseClientLike,
  table: "activity_weeks" | "activity_days",
  id: string,
  logContext: { event: string; correlationId?: string | null }
): Promise<CapacityMutationResult> {
  const { data: row } = await supabase.from(table).select("spots_left, capacity").eq("id", id).single();
  if (!row) return { applied: false, spotsLeft: 0 };

  if (row.spots_left <= 0) {
    // Non è un errore applicativo silenzioso: un tentativo di reserve su
    // capacità già esaurita è un segnale utile (race condition tra due
    // risposte quasi simultanee, o UI che non ha ricaricato lo stato) — lo
    // registriamo qui invece di lasciarlo un no-op invisibile come nel
    // codice pre-Sprint 6.
    logTelemetryEvent({
      event: logContext.event,
      correlationId: logContext.correlationId,
      detail: `reserve rifiutata: spots_left già a 0 (${table}#${id.slice(0, 8)})`,
    });
    return { applied: false, spotsLeft: row.spots_left };
  }

  const next = clampSpotsLeft(row.spots_left - 1, row.capacity ?? row.spots_left);
  await supabase.from(table).update({ spots_left: next }).eq("id", id);
  return { applied: true, spotsLeft: next };
}

async function releaseSpot(
  supabase: SupabaseClientLike,
  table: "activity_weeks" | "activity_days",
  id: string
): Promise<CapacityMutationResult> {
  const { data: row } = await supabase.from(table).select("spots_left, capacity").eq("id", id).single();
  if (!row) return { applied: false, spotsLeft: 0 };

  const next = clampSpotsLeft(row.spots_left + 1, row.capacity ?? row.spots_left + 1);
  await supabase.from(table).update({ spots_left: next }).eq("id", id);
  return { applied: true, spotsLeft: next };
}

// ─────────────────────────────────────────────
// Settimana intera (activity_weeks + booking_weeks.capacity_decremented,
// migration_18 — colonna additiva che chiude il gap di idempotenza/rilascio
// diagnosticato in CORE_DOMAIN_SOURCE_OF_TRUTH.md §5).
// ─────────────────────────────────────────────

/**
 * Riserva un posto per una settimana, SOLO se questa riga booking_weeks non
 * lo ha già fatto (capacity_decremented=false). Idempotente: chiamarla due
 * volte sulla stessa riga non decrementa due volte.
 */
export async function reserveWeekCapacity(
  supabase: SupabaseClientLike,
  bookingId: string,
  weekId: string,
  correlationId?: string | null
): Promise<CapacityMutationResult> {
  const { data: bw } = await supabase
    .from("booking_weeks")
    .select("capacity_decremented")
    .eq("booking_id", bookingId)
    .eq("week_id", weekId)
    .single();
  if (!bw || bw.capacity_decremented) return { applied: false, spotsLeft: -1 };

  const result = await reserveSpot(supabase, "activity_weeks", weekId, {
    event: "capacity.week.reserve_rejected",
    correlationId,
  });
  if (result.applied) {
    await supabase
      .from("booking_weeks")
      .update({ capacity_decremented: true })
      .eq("booking_id", bookingId)
      .eq("week_id", weekId);
  }
  return result;
}

/**
 * Rilascia un posto per una settimana, SOLO se questa riga booking_weeks lo
 * aveva effettivamente riservato (capacity_decremented=true) — chiude il bug
 * per cui cancelBookingAction non rilasciava mai la capacità settimanale.
 */
export async function releaseWeekCapacity(
  supabase: SupabaseClientLike,
  bookingId: string,
  weekId: string
): Promise<CapacityMutationResult> {
  const { data: bw } = await supabase
    .from("booking_weeks")
    .select("capacity_decremented")
    .eq("booking_id", bookingId)
    .eq("week_id", weekId)
    .single();
  if (!bw || !bw.capacity_decremented) return { applied: false, spotsLeft: -1 };

  const result = await releaseSpot(supabase, "activity_weeks", weekId);
  if (result.applied) {
    await supabase
      .from("booking_weeks")
      .update({ capacity_decremented: false })
      .eq("booking_id", bookingId)
      .eq("week_id", weekId);
  }
  return result;
}

/** Rilascia la capacità di TUTTE le settimane di una prenotazione ancora marcate come decrementate — usata da cancelBookingAction (annullamento dell'intera prenotazione). */
export async function releaseAllWeekCapacityForBooking(
  supabase: SupabaseClientLike,
  bookingId: string
): Promise<void> {
  const { data: weeks } = await supabase
    .from("booking_weeks")
    .select("week_id, capacity_decremented")
    .eq("booking_id", bookingId);
  for (const w of weeks ?? []) {
    if (w.capacity_decremented) {
      await releaseWeekCapacity(supabase, bookingId, w.week_id);
    }
  }
}

// ─────────────────────────────────────────────
// Giorno singolo (activity_days + booking_days.capacity_decremented, già
// esistente da Sprint 4/DEC-42 — qui solo centralizzato, stesso
// comportamento di prima).
// ─────────────────────────────────────────────

export async function reserveDayCapacity(
  supabase: SupabaseClientLike,
  bookingId: string,
  activityDayId: string,
  correlationId?: string | null
): Promise<CapacityMutationResult> {
  const { data: bd } = await supabase
    .from("booking_days")
    .select("capacity_decremented")
    .eq("booking_id", bookingId)
    .eq("activity_day_id", activityDayId)
    .single();
  if (!bd || bd.capacity_decremented) return { applied: false, spotsLeft: -1 };

  const result = await reserveSpot(supabase, "activity_days", activityDayId, {
    event: "capacity.day.reserve_rejected",
    correlationId,
  });
  if (result.applied) {
    await supabase
      .from("booking_days")
      .update({ capacity_decremented: true })
      .eq("booking_id", bookingId)
      .eq("activity_day_id", activityDayId);
  }
  return result;
}

export async function releaseDayCapacity(
  supabase: SupabaseClientLike,
  bookingId: string,
  activityDayId: string
): Promise<CapacityMutationResult> {
  const { data: bd } = await supabase
    .from("booking_days")
    .select("capacity_decremented")
    .eq("booking_id", bookingId)
    .eq("activity_day_id", activityDayId)
    .single();
  if (!bd || !bd.capacity_decremented) return { applied: false, spotsLeft: -1 };

  const result = await releaseSpot(supabase, "activity_days", activityDayId);
  if (result.applied) {
    await supabase
      .from("booking_days")
      .update({ capacity_decremented: false })
      .eq("booking_id", bookingId)
      .eq("activity_day_id", activityDayId);
  }
  return result;
}
