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
import { notifyAvailabilityBackInStock } from "@/lib/notifications/availability-push";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

export interface CapacityMutationResult {
  /** true se la mutazione ha avuto effetto (reserve riuscita / release riuscita). */
  applied: boolean;
  /** Valore di spots_left DOPO la mutazione (o quello attuale se applied=false). */
  spotsLeft: number;
  /**
   * TRAMA FINAL HARDENING §4-8 — true SOLO per un release il cui
   * spots_left era ESATTAMENTE 0 nel preciso istante prima di questa
   * specifica mutazione riuscita (mai per ogni incremento) — il segnale
   * esatto richiesto per il trigger della push "è tornato un posto",
   * garantito unico dal CAS: solo la mutazione che vince quella transizione
   * può vedere row.spots_left===0. undefined per reserveSpot (non
   * applicabile — una reserve non può mai generare disponibilità).
   */
  wasZeroBeforeRelease?: boolean;
}

/** Invariante pura, senza I/O: mai sotto 0, mai sopra capacity. Esportata per essere testata isolatamente. */
export function clampSpotsLeft(value: number, capacity: number): number {
  if (capacity < 0) capacity = 0;
  return Math.min(Math.max(value, 0), capacity);
}

// PRE-LAUNCH REMEDIATION WAVE 1 — R-07 (decisione Fabrizio, 24/08/2026):
// reserveSpot/releaseSpot leggevano spots_left e poi lo scrivevano in due
// passi separati (SELECT poi UPDATE), senza alcuna verifica che la riga
// fosse ancora nello stato letto — una vera race condition: due reserve
// quasi simultanee sull'ultimo posto potevano entrambe leggere
// spots_left=1, entrambe calcolare next=0, entrambe scrivere "riuscito",
// causando un overbooking di un posto. Fix scelto (il meno invasivo
// possibile, nessuna nuova tabella/migrazione, nessun workaround
// lato client): Compare-And-Swap applicativo — l'UPDATE include
// `.eq("spots_left", row.spots_left)` (scrivi SOLO se nessun altro ha già
// cambiato il valore che ho appena letto) e legge le righe restituite da
// `.select()` per sapere con certezza se la scrittura ha avuto effetto
// (Postgres/PostgREST non restituisce altrimenti un "affected rows"
// affidabile lato client). Se il CAS fallisce (0 righe — un'altra richiesta
// concorrente ha vinto), si rilegge lo stato fresco e si riprova, fino a
// MAX_CAS_ATTEMPTS tentativi: NON un errore permanente, è la stessa identica
// situazione di due persone che premono "conferma" nello stesso istante,
// una delle due deve rileggere lo stato aggiornato e ridecidere.
// Prova di correttezza: tests/one/capacity-concurrency.spec.ts (client
// Supabase fittizio che riproduce deterministicamente due lettori che
// vedono lo stesso spots_left prima che nessuno dei due scriva — gira in
// qualunque ambiente, non richiede un deploy reale).
const MAX_CAS_ATTEMPTS = 5;

async function reserveSpot(
  supabase: SupabaseClientLike,
  table: "activity_weeks" | "activity_days",
  id: string,
  logContext: { event: string; correlationId?: string | null }
): Promise<CapacityMutationResult> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
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
    const { data: updated } = await supabase
      .from(table)
      .update({ spots_left: next })
      .eq("id", id)
      .eq("spots_left", row.spots_left)
      .select("spots_left");

    if (updated && updated.length > 0) {
      return { applied: true, spotsLeft: next };
    }
    // CAS fallito: un'altra richiesta ha scritto tra la nostra lettura e la
    // nostra scrittura — rileggere lo stato fresco e riprovare (prossimo giro).
  }

  // Contesa persistente oltre i tentativi previsti — trattarla come rifiuto
  // sicuro (mai un doppio decremento) invece di un crash o un ultimo
  // tentativo alla cieca.
  logTelemetryEvent({
    event: logContext.event,
    correlationId: logContext.correlationId,
    detail: `reserve rifiutata dopo ${MAX_CAS_ATTEMPTS} tentativi CAS falliti (${table}#${id.slice(0, 8)})`,
  });
  const { data: fallback } = await supabase.from(table).select("spots_left").eq("id", id).single();
  return { applied: false, spotsLeft: fallback?.spots_left ?? 0 };
}

async function releaseSpot(
  supabase: SupabaseClientLike,
  table: "activity_weeks" | "activity_days",
  id: string
): Promise<CapacityMutationResult> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: row } = await supabase.from(table).select("spots_left, capacity").eq("id", id).single();
    if (!row) return { applied: false, spotsLeft: 0 };

    const wasZero = row.spots_left === 0;
    const next = clampSpotsLeft(row.spots_left + 1, row.capacity ?? row.spots_left + 1);
    const { data: updated } = await supabase
      .from(table)
      .update({ spots_left: next })
      .eq("id", id)
      .eq("spots_left", row.spots_left)
      .select("spots_left");

    if (updated && updated.length > 0) {
      return { applied: true, spotsLeft: next, wasZeroBeforeRelease: wasZero };
    }
  }

  const { data: fallback } = await supabase.from(table).select("spots_left").eq("id", id).single();
  return { applied: false, spotsLeft: fallback?.spots_left ?? 0 };
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
    // TRAMA FINAL HARDENING §4-8 — trigger event-driven della push
    // "è tornato un posto" SOLO sulla vera transizione 0→disponibile (vedi
    // commento su CapacityMutationResult.wasZeroBeforeRelease sopra e la
    // documentazione di scope in lib/notifications/availability-push.ts).
    // Fire-and-await (non fire-and-forget): un ambiente serverless può
    // terminare la funzione non appena la risposta HTTP parte, un
    // "dimenticato" non awaited rischierebbe di non completare mai l'invio.
    // Best-effort per costruzione (mai un'eccezione qui): non deve mai far
    // fallire il release di capacità che l'ha generato.
    if (result.wasZeroBeforeRelease) {
      const { data: weekRow } = await supabase.from("activity_weeks").select("activity_id").eq("id", weekId).single();
      if (weekRow?.activity_id) {
        await notifyAvailabilityBackInStock({ kind: "week", activityId: weekRow.activity_id, weekId });
      }
    }
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
    // TRAMA FINAL HARDENING §4-8 — stesso trigger di releaseWeekCapacity
    // sopra, per il ramo "Giorni spot".
    if (result.wasZeroBeforeRelease) {
      const { data: dayRow } = await supabase
        .from("activity_days")
        .select("activity_id")
        .eq("id", activityDayId)
        .single();
      if (dayRow?.activity_id) {
        await notifyAvailabilityBackInStock({ kind: "day", activityId: dayRow.activity_id, activityDayId });
      }
    }
  }
  return result;
}
