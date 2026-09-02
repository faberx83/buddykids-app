// Risposta per SINGOLO GIORNO (Giorni spot — accettazione/rifiuto parziale,
// richiesto esplicitamente da SPRINT_GOVERNANCE.md).
//
// 02/09/2026 — segnalazione beta (genitore, /center/prenotazioni): "seleziona
// tutto su più giorni" in accettazione + "come si verifica se ho ancora
// disponibilità" + "considerare lista d'attesa". Analizzando la seconda
// domanda è emerso un bug reale indipendente dalla feature: la vecchia
// respondToBookingDayAction (app/actions/booking-response.ts) scriveva
// partner_decision='accepted' PRIMA di verificare se reserveDayCapacity
// riusciva davvero — se activity_days.spots_left era già a 0 (giorno pieno,
// es. un'altra richiesta accettata nel frattempo), il giorno risultava
// "Accettato" in UI e il genitore riceveva l'email di conferma, ma
// reserveDayCapacity si limitava a rifiutare in silenzio (nessun posto
// realmente riservato, capacity_decremented restava false) — overbooking
// silenzioso mai segnalato al centro.
//
// Fix + feature, entrambi qui: la capacità viene verificata PRIMA di
// scrivere la decisione finale. Se il giorno è pieno, invece di rifiutare
// silenziosamente o overbookare, la richiesta va in lista d'attesa
// ('waitlisted', supabase/migration_34_booking_days_waitlist.sql — additiva,
// NON applicata da questa sessione). Se quella migrazione non è ancora
// applicata, la scrittura del valore 'waitlisted' fallisce per vincolo CHECK
// inesistente: applyDayDecision intercetta questo caso specifico e degrada
// in modo sicuro lasciando il giorno 'pending' con un messaggio esplicito
// ("waitlisted_unavailable") — MAI un accept oltre capacità, MAI un errore
// opaco per il centro.
//
// Modulo SEPARATO da app/actions/booking-response.ts (che la usa, insieme a
// respondToBookingDaysAction/promoteWaitlistedDayAction) per un motivo di
// testabilità, non di feature: quel file è "use server" e importa anche
// lib/push/send.ts (`import "server-only"`), un import che il runtime Node
// "nudo" dei test Playwright non-browser non risolve fuori dal bundler di
// Next. Isolare qui la logica pura (stesso principio già seguito da
// lib/capacity/service.ts, che infatti È testabile in
// tests/one/capacity-concurrency.spec.ts) permette
// tests/one/booking-days-waitlist.spec.ts di importarla direttamente con un
// client Supabase fittizio.

import { createClient } from "@/lib/supabase/server";
import { reserveDayCapacity } from "@/lib/capacity/service";
import { notifyParentOfBookingResponse } from "./notify";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

export type DayDecisionStatus = "accepted" | "rejected" | "waitlisted" | "waitlisted_unavailable";
export type DayDecisionResult = { status: DayDecisionStatus } | { status: "error"; error: string };

export async function applyDayDecision(
  supabase: SupabaseClientLike,
  bookingId: string,
  activityDayId: string,
  requestedDecision: "accepted" | "rejected"
): Promise<DayDecisionResult> {
  const { data: day, error: fetchError } = await supabase
    .from("booking_days")
    .select("partner_decision, capacity_decremented")
    .eq("booking_id", bookingId)
    .eq("activity_day_id", activityDayId)
    .single();
  if (fetchError || !day) return { status: "error", error: "Giorno non trovato in questa prenotazione" };

  // Decremento capacità del giorno, delegato al servizio canonico
  // (lib/capacity/service.ts) — idempotente via booking_days.capacity_decremented.
  // reserveDayCapacity va chiamata (e il suo esito verificato) PRIMA di
  // scrivere qualunque decisione finale: è l'unico modo di sapere con
  // certezza se il giorno ha davvero un posto libero.
  let finalDecision: "accepted" | "rejected" | "waitlisted" = requestedDecision;
  if (requestedDecision === "accepted" && !day.capacity_decremented) {
    const capacityResult = await reserveDayCapacity(supabase, bookingId, activityDayId);
    if (!capacityResult.applied) {
      finalDecision = "waitlisted";
    }
  }

  const update: Record<string, unknown> = { partner_decision: finalDecision };
  if (finalDecision === "waitlisted") update.waitlisted_at = new Date().toISOString();

  const { error } = await supabase
    .from("booking_days")
    .update(update)
    .eq("booking_id", bookingId)
    .eq("activity_day_id", activityDayId);

  if (error && finalDecision === "waitlisted") {
    // migration_34 quasi certamente non ancora applicata (valore/colonna
    // inesistente lato DB) — nessuna capacità è stata consumata sopra
    // (reserveDayCapacity ha già rifiutato prima di arrivare qui), quindi è
    // sicuro lasciare il giorno esplicitamente 'pending' invece di un
    // 'waitlisted' mai scritto con successo.
    const fallback = await supabase
      .from("booking_days")
      .update({ partner_decision: "pending" })
      .eq("booking_id", bookingId)
      .eq("activity_day_id", activityDayId);
    if (fallback.error) return { status: "error", error: fallback.error.message };
    return { status: "waitlisted_unavailable" };
  }
  if (error) return { status: "error", error: error.message };

  // Notifica/badge a livello di intera prenotazione, coerente col pattern
  // read_by_side: una risposta su un singolo giorno è comunque "una novità"
  // per il genitore sulla prenotazione nel suo complesso.
  await supabase
    .from("bookings")
    .update({ read_by_parent: false, read_by_center: true, responded_at: new Date().toISOString() })
    .eq("id", bookingId);

  // Task #360 (PT-MVP-12/backlog #355): email al genitore anche per la
  // risposta a singolo giorno (non solo a livello di intera prenotazione).
  // Estesa il 02/09/2026 per coprire anche l'esito 'waitlisted'.
  const { data: activityDay } = await supabase
    .from("activity_days")
    .select("date")
    .eq("id", activityDayId)
    .single();
  const dayLabel = activityDay?.date
    ? new Date(activityDay.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })
    : undefined;
  await notifyParentOfBookingResponse(supabase, bookingId, finalDecision, undefined, dayLabel);

  return { status: finalDecision };
}
