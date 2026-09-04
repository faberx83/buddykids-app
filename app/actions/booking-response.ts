"use server";

// TRAMA ONE Build Sprint 4 (DEC-42) — Risposta del Partner a una
// prenotazione: accetta/rifiuta/proponi alternativa (a livello di intera
// prenotazione, per le prenotazioni a settimana intera) o accetta/rifiuta
// per singolo giorno (prenotazioni "Giorni spot", booking_days). Stesso
// principio di app/actions/inquiries.ts::replyToInquiryAction (RLS fa già
// rispettare i confini centro/attività, qui si sceglie solo quali colonne
// scrivere), esteso con la decrementazione idempotente della capacità
// (activity_days.spots_left / activity_weeks.spots_left) richiesta da
// SPRINT_GOVERNANCE.md ("capacità per giorno") — gap esplicitamente lasciato
// aperto da Sprint 2/3 (DEC-38) e chiuso qui.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
// TRAMA ONE Build Sprint 6 (backlog vincolante P1, Capacity) — reserve/release
// centralizzati in lib/capacity/service.ts, con idempotenza esplicita
// (booking_weeks/booking_days.capacity_decremented) invece della logica
// sparsa qui prima presente. Vedi migration_18_capacity_service.sql.
import {
  releaseDayCapacity,
  releaseWeekCapacity,
  reserveDayCapacity,
  reserveWeekCapacity,
} from "@/lib/capacity/service";
// Push notifications (31/08/2026) — trigger P0 "il centro ha una proposta
// per te" (SOLO decision==="proposed", l'unico caso ACTION nel notification
// center in-app, vedi lib/data/notifications.ts). Best-effort per
// costruzione, stesso principio dell'email sotto.
import { sendPushToUser } from "@/lib/push/send";
// Notifica email al genitore + applyDayDecision (verifica di disponibilità
// prima di scrivere la decisione finale + lista d'attesa, segnalazione beta
// 02/09/2026) — estratti in lib/booking-response/ il 02/09/2026 PER
// TESTABILITÀ: questo file è "use server" e importa lib/push/send.ts sopra
// (`import "server-only"`), un import che i test Playwright non-browser non
// risolvono fuori dal bundler di Next. Vedi il commento in testa a
// lib/booking-response/apply-day-decision.ts e
// tests/one/booking-days-waitlist.spec.ts. Nessun comportamento cambiato,
// solo spostato.
import { notifyParentOfBookingResponse } from "@/lib/booking-response/notify";
import {
  applyDayDecision,
  DayDecisionStatus,
} from "@/lib/booking-response/apply-day-decision";
export type { DayDecisionStatus, DayDecisionResult } from "@/lib/booking-response/apply-day-decision";

// Push notifications, trigger P0 "il centro ha una proposta per te"
// (31/08/2026). Funzione SEPARATA da notifyParentOfBookingResponse sopra
// invece di annidata al suo interno: quella funzione ritorna PRIMA di
// leggere bookingId/parent_id se isEmailConfigured è false (early return,
// vedi sopra) — annidare la push lì dentro l'avrebbe resa dipendente da
// RESEND_API_KEY configurata, un accoppiamento sbagliato (email e push sono
// due canali indipendenti). Costa una piccola query in più, non un
// refactor della funzione email già in produzione.
async function notifyParentOfBookingResponsePush(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  proposalNote?: string
) {
  try {
    const { data: row } = await supabase
      .from("bookings")
      .select("parent_id, activities ( name )")
      .eq("id", bookingId)
      .single();
    if (!row?.parent_id) return;
    const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
    await sendPushToUser(row.parent_id, {
      title: `Il centro ha una proposta per te: ${activity?.name ?? "la tua prenotazione"}`,
      body: proposalNote?.trim() || "Rivedi la proposta del centro e rispondi.",
      deepLink: `/nextgen/prenotazioni?bookingId=${bookingId}`,
    });
  } catch (e) {
    console.error(`[booking-response] Errore inatteso durante la push al genitore (bookingId=${bookingId}):`, e);
  }
}

function revalidateBookingPaths() {
  revalidatePath("/center/prenotazioni");
  revalidatePath("/prenotazioni");
  revalidatePath("/admin/bookings");
  revalidatePath("/one/planner");
  revalidatePath("/nextgen/planner");
}

// ─────────────────────────────────────────────
// Risposta a livello di INTERA prenotazione (settimana intera, o Giorni spot
// senza granularità per giorno se il centro preferisce rispondere in blocco).
// ─────────────────────────────────────────────
export type BookingResponseDecision = "accepted" | "rejected" | "proposed";

export async function respondToBookingAction(input: {
  bookingId: string;
  decision: BookingResponseDecision;
  proposalNote?: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.decision === "proposed" && !input.proposalNote?.trim()) {
    return { error: "Scrivi una proposta prima di inviare" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, partner_decision")
    .eq("id", input.bookingId)
    .single();
  if (fetchError || !booking) return { error: "Prenotazione non trovata" };
  if (booking.status === "cancelled") return { error: "Questa prenotazione è stata annullata" };

  // FIX (TRAMA FINAL HARDENING, segnalazione Fabrizio 04/09/2026 — root
  // cause audit): prima di questo fix, "accepted" scriveva status=
  // 'confirmed' PRIMA di verificare se reserveWeekCapacity riusciva
  // davvero, e il risultato della reserve veniva scartato senza leggerlo —
  // overbooking silenzioso identico al bug già corretto per i giorni spot
  // in applyDayDecision.ts (vedi commento lì), mai chiuso qui per le
  // prenotazioni a settimana intera. A differenza dei giorni spot, non
  // esiste un concetto di "lista d'attesa" a livello di intera prenotazione
  // (introdurne uno sarebbe un redesign, fuori scope di questa wave): se la
  // capacità di ALMENO UNA delle settimane è esaurita, l'accettazione viene
  // RIFIUTATA esplicitamente (nessuna scrittura di stato, errore chiaro al
  // gestore) invece di confermare oltre capacità — e le eventuali settimane
  // già riservate in questo stesso tentativo vengono rilasciate (rollback
  // compensativo), così un fallimento parziale non lascia capacità
  // "fantasma" bloccata.
  if (input.decision === "accepted" && booking.partner_decision !== "accepted") {
    const { data: weeks } = await supabase
      .from("booking_weeks")
      .select("week_id, capacity_decremented")
      .eq("booking_id", input.bookingId);
    const weekRows = weeks ?? [];
    const reservedSoFar: string[] = [];
    let capacityError = false;
    for (const w of weekRows) {
      const weekId = w.week_id as string;
      // Idempotenza: se questa riga booking_weeks ha GIÀ riservato la
      // capacità (es. tentativo precedente riuscito parzialmente e poi
      // interrotto prima del commit dello status, o doppio submit), NON è
      // un fallimento — reserveWeekCapacity la ritratterebbe come
      // "applied:false" indistinguibile da "capacità esaurita" (stesso
      // shape di ritorno), quindi va riconosciuta qui PRIMA di chiamarla,
      // altrimenti una richiesta idempotente verrebbe rifiutata per errore.
      if (w.capacity_decremented) continue;
      const result = await reserveWeekCapacity(supabase, input.bookingId, weekId, undefined);
      if (!result.applied) {
        capacityError = true;
        break;
      }
      reservedSoFar.push(weekId);
    }
    if (capacityError) {
      // Rollback delle settimane riservate in QUESTO tentativo (non quelle
      // già decrementate da un tentativo precedente, che restano valide —
      // releaseWeekCapacity è comunque idempotente e no-op se
      // capacity_decremented è già false, quindi rilasciare solo
      // reservedSoFar è corretto e sufficiente).
      for (const reservedWeekId of reservedSoFar) {
        await releaseWeekCapacity(supabase, input.bookingId, reservedWeekId);
      }
      return {
        error:
          "Non ci sono più posti disponibili per almeno una delle settimane di questa prenotazione (probabilmente accettata nel frattempo un'altra richiesta sull'ultimo posto). La prenotazione NON è stata confermata — contatta la famiglia per un'alternativa.",
      };
    }
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    partner_decision: input.decision,
    responded_at: nowIso,
    // Stesso pattern read_by_side di activity_inquiries: il genitore deve
    // accorgersi della risposta (torna a false), il centro l'ha appena
    // scritta (resta/torna true).
    read_by_parent: false,
    read_by_center: true,
  };

  if (input.decision === "accepted") {
    // Arriviamo qui SOLO se la capacità di ogni settimana è stata riservata
    // con successo sopra (o se questa prenotazione era già accettata prima).
    update.status = "confirmed";
  } else if (input.decision === "rejected") {
    update.status = "cancelled";
    update.cancelled_by = "center";
  } else if (input.decision === "proposed") {
    update.partner_proposal_note = input.proposalNote!.trim();
    update.partner_proposed_at = nowIso;
    // "status" resta "pending" — la prenotazione non è né confermata né
    // annullata finché il genitore non decide sulla proposta.
  }

  const { error } = await supabase.from("bookings").update(update).eq("id", input.bookingId);
  if (error) return { error: error.message };

  await notifyParentOfBookingResponse(supabase, input.bookingId, input.decision, input.proposalNote);
  // ACTION solo per "proposed" (vedi lib/data/notifications.ts: accepted/
  // rejected sono già decisioni definitive, IMPORTANT, fuori dallo scope P0
  // delle push — decisione esplicita, non un'omissione).
  if (input.decision === "proposed") {
    await notifyParentOfBookingResponsePush(supabase, input.bookingId, input.proposalNote);
  }

  revalidateBookingPaths();
  return {};
}

// ─────────────────────────────────────────────
// Risposta per SINGOLO GIORNO (Giorni spot — accettazione/rifiuto parziale,
// richiesto esplicitamente da SPRINT_GOVERNANCE.md).
//
// 02/09/2026 — segnalazione beta (genitore, /center/prenotazioni): "seleziona
// tutto su più giorni" in accettazione + "come si verifica se ho ancora
// disponibilità" + "considerare lista d'attesa". La logica di verifica
// disponibilità/lista d'attesa (con il fix del bug di overbooking silenzioso
// che c'era prima) vive ora in
// lib/booking-response/apply-day-decision.ts::applyDayDecision (importata
// sopra), condivisa da questa funzione, dalla nuova
// respondToBookingDaysAction (accettazione multi-giorno) e da
// promoteWaitlistedDayAction più sotto.
// ─────────────────────────────────────────────
export async function respondToBookingDayAction(input: {
  bookingId: string;
  activityDayId: string;
  decision: "accepted" | "rejected";
}): Promise<{ error?: string; result?: DayDecisionStatus }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const result = await applyDayDecision(supabase, input.bookingId, input.activityDayId, input.decision);
  if (result.status === "error") return { error: result.error };

  revalidateBookingPaths();
  return { result: result.status };
}

// ─────────────────────────────────────────────
// "Seleziona tutto su più giorni" (segnalazione beta 02/09/2026) — risposta
// in blocco a più giorni della STESSA prenotazione "Giorni spot" in una
// sola chiamata, riusando applyDayDecision (stessa verifica di
// disponibilità/lista d'attesa per OGNI giorno selezionato, nessuna logica
// duplicata). Ritorna un riepilogo per-esito invece di un singolo
// error/ok: il centro deve sapere ESATTAMENTE quanti giorni sono stati
// accettati, quanti messi in lista d'attesa (pieni) e quanti falliti — un
// "successo/fallimento" unico avrebbe nascosto un accettazione parziale
// (es. 5 di 7 giorni), l'esito più comune quando alcuni giorni sono pieni.
// ─────────────────────────────────────────────
export interface BulkDayDecisionSummary {
  accepted: number;
  rejected: number;
  waitlisted: number;
  waitlistUnavailable: number;
  failed: number;
  error?: string; // valorizzato solo se l'intera operazione non è potuta partire (es. non autenticato) — nessun giorno processato.
  results: Record<string, DayDecisionStatus | "error">;
}

export async function respondToBookingDaysAction(input: {
  bookingId: string;
  activityDayIds: string[];
  decision: "accepted" | "rejected";
}): Promise<BulkDayDecisionSummary> {
  const empty = { accepted: 0, rejected: 0, waitlisted: 0, waitlistUnavailable: 0, failed: 0, results: {} };
  if (!isSupabaseConfigured) return { ...empty, error: "Supabase non configurato" };
  if (input.activityDayIds.length === 0) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...empty, error: "Non autenticato" };

  const summary: BulkDayDecisionSummary = { accepted: 0, rejected: 0, waitlisted: 0, waitlistUnavailable: 0, failed: 0, results: {} };

  // Sequenziale, deliberatamente NON Promise.all: ogni riga passa da
  // reserveDayCapacity, che fa CAS su activity_days.spots_left (vedi
  // lib/capacity/service.ts) — eseguire le richieste in parallelo
  // aumenterebbe solo la contesa CAS senza alcun vantaggio reale (il centro
  // clicca un bottone, non è un percorso ad alta frequenza), stesso
  // principio prudente già seguito da releaseAllWeekCapacityForBooking.
  for (const activityDayId of input.activityDayIds) {
    const result = await applyDayDecision(supabase, input.bookingId, activityDayId, input.decision);
    summary.results[activityDayId] = result.status;
    if (result.status === "error") summary.failed++;
    else if (result.status === "accepted") summary.accepted++;
    else if (result.status === "rejected") summary.rejected++;
    else if (result.status === "waitlisted") summary.waitlisted++;
    else if (result.status === "waitlisted_unavailable") summary.waitlistUnavailable++;
  }

  revalidateBookingPaths();
  return summary;
}

// ─────────────────────────────────────────────
// Promozione MANUALE da lista d'attesa (segnalazione beta 02/09/2026) — il
// centro riprova la riserva quando pensa che si sia liberato un posto (es.
// dopo cancelBookingDayAction su un altro giorno pieno). Promozione
// automatica in tempo reale (trigger su ogni cancellazione) è
// esplicitamente FUORI scope qui — vedi nota in
// supabase/migration_34_booking_days_waitlist.sql: più delicata (notifiche,
// race condition tra più giorni in coda), lasciata a un momento successivo.
// ─────────────────────────────────────────────
export async function promoteWaitlistedDayAction(input: {
  bookingId: string;
  activityDayId: string;
}): Promise<{ error?: string; promoted?: boolean }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: day, error: fetchError } = await supabase
    .from("booking_days")
    .select("partner_decision")
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId)
    .single();
  if (fetchError || !day) return { error: "Giorno non trovato in questa prenotazione" };
  if (day.partner_decision !== "waitlisted") return { error: "Questo giorno non è in lista d'attesa" };

  const capacityResult = await reserveDayCapacity(supabase, input.bookingId, input.activityDayId);
  if (!capacityResult.applied) {
    return { error: "Ancora nessun posto disponibile per questo giorno.", promoted: false };
  }

  const { error } = await supabase
    .from("booking_days")
    .update({ partner_decision: "accepted" })
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId);
  if (error) return { error: error.message };

  await supabase
    .from("bookings")
    .update({ read_by_parent: false, read_by_center: true, responded_at: new Date().toISOString() })
    .eq("id", input.bookingId);

  const { data: activityDay } = await supabase
    .from("activity_days")
    .select("date")
    .eq("id", input.activityDayId)
    .single();
  const dayLabel = activityDay?.date
    ? new Date(activityDay.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })
    : undefined;
  await notifyParentOfBookingResponse(supabase, input.bookingId, "accepted", undefined, dayLabel);

  revalidateBookingPaths();
  return { promoted: true };
}

// ─────────────────────────────────────────────
// Cancellazione per singolo giorno (Task #347) — a differenza di
// cancelBookingAction (app/actions/bookings.ts, annulla l'INTERA
// prenotazione), qui si rimuove un solo booking_day lasciando gli altri
// intatti. "Rimborso" = solo adeguamento di total_amount (nessuna
// integrazione pagamenti reale nel repository, stesso limite già
// documentato per cancelBookingAction).
// ─────────────────────────────────────────────
export async function cancelBookingDayAction(input: {
  bookingId: string;
  activityDayId: string;
  cancelledBy: "parent" | "center";
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: day, error: fetchError } = await supabase
    .from("booking_days")
    .select("price, capacity_decremented, activity_day_id")
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId)
    .single();
  if (fetchError || !day) return { error: "Giorno non trovato in questa prenotazione" };

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("total_amount, status")
    .eq("id", input.bookingId)
    .single();
  if (bookingError || !booking) return { error: "Prenotazione non trovata" };
  if (booking.status === "cancelled") return { error: "Questa prenotazione è già stata annullata" };

  // Ripristina la capacità se era stata decrementata (accettazione revocata
  // dalla cancellazione) — delegato al servizio canonico, che clampa il
  // rilascio a `capacity` (mai sopra il totale posti), invarianza esplicita
  // richiesta dal backlog vincolante Sprint 6.
  if (day.capacity_decremented) {
    await releaseDayCapacity(supabase, input.bookingId, input.activityDayId);
  }

  const { error: delError } = await supabase
    .from("booking_days")
    .delete()
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId);
  if (delError) return { error: delError.message };

  const newTotal = Math.max(0, booking.total_amount - day.price);
  const { count: remainingDays } = await supabase
    .from("booking_days")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", input.bookingId);

  const bookingUpdate: Record<string, unknown> = { total_amount: newTotal };
  // Se era l'ultimo giorno rimasto, l'intera prenotazione è di fatto vuota:
  // annullala esplicitamente invece di lasciare una prenotazione "confirmed"
  // senza alcun giorno prenotato.
  if ((remainingDays ?? 0) === 0) {
    bookingUpdate.status = "cancelled";
    bookingUpdate.cancelled_by = input.cancelledBy;
  }
  const { error: updError } = await supabase
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", input.bookingId);
  if (updError) return { error: updError.message };

  revalidateBookingPaths();
  return {};
}

// ─────────────────────────────────────────────
// Letta/non letta (badge) — stesso pattern esatto di
// app/actions/inquiries.ts::markInquiriesReadAction.
// ─────────────────────────────────────────────
export async function markBookingsReadAction(input: {
  ids: string[];
  side: "parent" | "center";
  read: boolean;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.ids.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const column = input.side === "parent" ? "read_by_parent" : "read_by_center";
  const { error } = await supabase
    .from("bookings")
    .update({ [column]: input.read })
    .in("id", input.ids);
  if (error) return { error: error.message };

  revalidatePath(input.side === "parent" ? "/prenotazioni" : "/center/prenotazioni");
  return {};
}
