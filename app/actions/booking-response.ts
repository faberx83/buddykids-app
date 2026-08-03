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
import { sendEmail, isEmailConfigured } from "@/lib/email";
// TRAMA ONE Build Sprint 6 (backlog vincolante P1, Capacity) — reserve/release
// centralizzati in lib/capacity/service.ts, con idempotenza esplicita
// (booking_weeks/booking_days.capacity_decremented) invece della logica
// sparsa qui prima presente. Vedi migration_18_capacity_service.sql.
import { releaseDayCapacity, reserveDayCapacity, reserveWeekCapacity } from "@/lib/capacity/service";

// TRAMA ONE Build Sprint 4 (DEC-42, PCR-029 P0) — notifica email al genitore
// quando il centro risponde a una prenotazione, stesso pattern best-effort
// già usato in app/actions/attendance.ts::setAttendanceAction (un eventuale
// errore di invio non fa mai fallire la risposta del centro, che è già stata
// salvata su bookings prima di questa chiamata).
// Task #360 (PT-MVP-12/backlog #355) — esteso per accettare un'etichetta di
// giorno opzionale: la stessa email serve sia per la risposta a livello di
// intera prenotazione (dayLabel assente) sia per la risposta a un singolo
// "Giorno spot" (dayLabel = data formattata), riusando lo stesso testo/subject
// invece di duplicare la funzione per il caso per-giorno introdotto da
// respondToBookingDayAction.
async function notifyParentOfBookingResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  decision: "accepted" | "rejected" | "proposed",
  proposalNote?: string,
  dayLabel?: string
) {
  if (!isEmailConfigured) return;
  try {
    const { data: row } = await supabase
      .from("bookings")
      .select("parent_id, activities ( name )")
      .eq("id", bookingId)
      .single();
    if (!row?.parent_id) return;
    const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
    const { data: parentRow } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", row.parent_id)
      .single();
    if (!parentRow?.email) return;

    const greeting = `Ciao${parentRow.full_name ? " " + parentRow.full_name.split(" ")[0] : ""},`;
    const activityName = activity?.name ?? "la tua prenotazione";
    const forWhat = dayLabel ? `<strong>${activityName}</strong> per il giorno <strong>${dayLabel}</strong>` : `<strong>${activityName}</strong>`;
    let subject: string;
    let body: string;
    if (decision === "accepted") {
      subject = dayLabel ? `Giorno confermato: ${activityName} (${dayLabel})` : `Prenotazione accettata: ${activityName}`;
      body = `<p>${greeting}</p><p>Il centro ha <strong>accettato</strong> la tua prenotazione per ${forWhat}.</p>`;
    } else if (decision === "rejected") {
      subject = dayLabel ? `Giorno non accettato: ${activityName} (${dayLabel})` : `Prenotazione non accettata: ${activityName}`;
      body = `<p>${greeting}</p><p>Il centro non ha potuto accettare la tua prenotazione per ${forWhat}. Contatta il centro per maggiori informazioni.</p>`;
    } else {
      subject = `Il centro ha una proposta per te: ${activityName}`;
      body = `<p>${greeting}</p><p>Il centro ha inviato una proposta alternativa per ${forWhat}:</p><p>${proposalNote ?? ""}</p>`;
    }
    await sendEmail({ to: parentRow.email, subject, html: body });
  } catch {
    // best effort — non blocca la risposta già salvata
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

  // Decremento capacità settimanale, solo su accettazione — ora delegato al
  // servizio canonico (lib/capacity/service.ts), che verifica ESSO STESSO
  // l'idempotenza per riga (booking_weeks.capacity_decremented, migration_18)
  // invece di fare affidamento solo sul controllo booking.partner_decision
  // qui sopra: due risposte quasi simultanee sulla stessa riga non possono
  // più decrementare due volte.
  if (input.decision === "accepted" && booking.partner_decision !== "accepted") {
    const { data: weeks } = await supabase
      .from("booking_weeks")
      .select("week_id")
      .eq("booking_id", input.bookingId);
    for (const w of weeks ?? []) {
      await reserveWeekCapacity(supabase, input.bookingId, w.week_id);
    }
  }

  revalidateBookingPaths();
  return {};
}

// ─────────────────────────────────────────────
// Risposta per SINGOLO GIORNO (Giorni spot — accettazione/rifiuto parziale,
// richiesto esplicitamente da SPRINT_GOVERNANCE.md).
// ─────────────────────────────────────────────
export async function respondToBookingDayAction(input: {
  bookingId: string;
  activityDayId: string;
  decision: "accepted" | "rejected";
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: day, error: fetchError } = await supabase
    .from("booking_days")
    .select("booking_id, activity_day_id, partner_decision, capacity_decremented")
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId)
    .single();
  if (fetchError || !day) return { error: "Giorno non trovato in questa prenotazione" };

  const update: Record<string, unknown> = { partner_decision: input.decision };

  const { error } = await supabase
    .from("booking_days")
    .update(update)
    .eq("booking_id", input.bookingId)
    .eq("activity_day_id", input.activityDayId);
  if (error) return { error: error.message };

  // Decremento capacità del giorno, ora delegato al servizio canonico
  // (lib/capacity/service.ts) — stesso comportamento di prima (idempotenza
  // via booking_days.capacity_decremented), solo centralizzato.
  if (input.decision === "accepted" && !day.capacity_decremented) {
    await reserveDayCapacity(supabase, input.bookingId, input.activityDayId);
  }

  // Notifica/badge a livello di intera prenotazione, coerente col pattern
  // read_by_side: una risposta su un singolo giorno è comunque "una novità"
  // per il genitore sulla prenotazione nel suo complesso.
  await supabase
    .from("bookings")
    .update({ read_by_parent: false, read_by_center: true, responded_at: new Date().toISOString() })
    .eq("id", input.bookingId);

  // Task #360 (PT-MVP-12/backlog #355) — gap individuato durante il check di
  // coerenza TRAMA ONE del 27/07: la risposta a livello di INTERA prenotazione
  // (respondToBookingAction) già inviava l'email al genitore da Sprint 4, ma
  // la risposta per SINGOLO GIORNO (questa funzione) non lo faceva — il
  // genitore vedeva l'esito solo come badge in-app. Stesso pattern
  // best-effort, dopo che lo stato è già stato salvato.
  const { data: activityDay } = await supabase
    .from("activity_days")
    .select("date")
    .eq("id", input.activityDayId)
    .single();
  const dayLabel = activityDay?.date
    ? new Date(activityDay.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })
    : undefined;
  await notifyParentOfBookingResponse(supabase, input.bookingId, input.decision, undefined, dayLabel);

  revalidateBookingPaths();
  return {};
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
