// Estratto da app/actions/booking-response.ts il 02/09/2026 (segnalazione
// beta "seleziona tutto su più giorni" + lista d'attesa) — NON per un
// motivo di feature, ma di testabilità: app/actions/booking-response.ts è
// un file "use server" che importa anche lib/push/send.ts (a sua volta
// `import "server-only"`), un import che il runtime Node "nudo" usato dai
// test Playwright non-browser (stesso principio di
// tests/one/capacity-concurrency.spec.ts) non riesce a risolvere fuori dal
// bundler di Next — vedi tests/one/booking-days-waitlist.spec.ts, che deve
// poter importare applyDayDecision (lib/booking-response/apply-day-decision.ts)
// SENZA trascinarsi dietro il modulo push. Questo file (email al genitore)
// dipende solo da lib/email.ts, che non ha alcun import "server-only" —
// isolarlo qui rompe quella catena. Nessun comportamento cambiato rispetto
// a prima: stesso codice, solo spostato.

import { createClient } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

// TRAMA ONE Build Sprint 6 (backlog vincolante P2, "email fire-and-forget",
// SPRINT_GOVERNANCE.md riga 151, DEC-49) — piccolo helper per scrivere
// l'esito dell'ultimo tentativo di invio su bookings.email_delivery_status
// (migration_19, non ancora applicata da Fabrizio). Scrittura anch'essa
// best-effort: se fallisce (es. migrazione non ancora applicata in
// produzione) non deve mai far fallire la risposta del centro, già salvata
// prima di arrivare qui — per questo è avvolta nel try/catch del chiamante,
// non ha uno suo try/catch dedicato.
async function recordEmailDeliveryStatus(
  supabase: SupabaseClientLike,
  bookingId: string,
  status: "sent" | "failed" | "not_configured" | "no_recipient",
  error?: string
) {
  await supabase
    .from("bookings")
    .update({
      email_delivery_status: status,
      email_delivery_error: error ?? null,
      email_delivery_attempted_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
}

// TRAMA ONE Build Sprint 4 (DEC-42, PCR-029 P0) — notifica email al genitore
// quando il centro risponde a una prenotazione, stesso pattern best-effort
// già usato in app/actions/attendance.ts::setAttendanceAction (un eventuale
// errore di invio non fa mai fallire la risposta del centro, che è già stata
// salvata su bookings prima di questa chiamata).
// Task #360 (PT-MVP-12/backlog #355) — esteso per accettare un'etichetta di
// giorno opzionale: la stessa email serve sia per la risposta a livello di
// intera prenotazione (dayLabel assente) sia per la risposta a un singolo
// "Giorno spot" (dayLabel = data formattata).
// "waitlisted" (02/09/2026, segnalazione beta "seleziona tutto su più
// giorni" + lista d'attesa) — aggiunto a questa union invece di una funzione
// email separata: un solo punto che sa come formattare subject/body per
// OGNI esito possibile della risposta del centro, instradato da
// lib/booking-response/apply-day-decision.ts::applyDayDecision.
export async function notifyParentOfBookingResponse(
  supabase: SupabaseClientLike,
  bookingId: string,
  decision: "accepted" | "rejected" | "proposed" | "waitlisted",
  proposalNote?: string,
  dayLabel?: string
) {
  if (!isEmailConfigured) {
    // Non è un fallimento: stesso comportamento "invio disattivato" già
    // documentato in lib/email.ts (nessuna RESEND_API_KEY configurata).
    // Registrato comunque per distinguere da un vero errore di invio.
    try {
      await recordEmailDeliveryStatus(supabase, bookingId, "not_configured");
    } catch {
      /* best effort, colonne potrebbero non esistere ancora (migration_19) */
    }
    return;
  }
  try {
    const { data: row } = await supabase
      .from("bookings")
      .select("parent_id, activities ( name )")
      .eq("id", bookingId)
      .single();
    if (!row?.parent_id) {
      await recordEmailDeliveryStatus(supabase, bookingId, "no_recipient");
      return;
    }
    const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
    const { data: parentRow } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", row.parent_id)
      .single();
    if (!parentRow?.email) {
      await recordEmailDeliveryStatus(supabase, bookingId, "no_recipient");
      return;
    }

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
    } else if (decision === "waitlisted") {
      subject = `In lista d'attesa: ${activityName}${dayLabel ? ` (${dayLabel})` : ""}`;
      body = `<p>${greeting}</p><p>Il giorno richiesto per ${forWhat} è al momento al completo. La tua richiesta resta <strong>in lista d'attesa</strong>: il centro ti avviserà se si libera un posto.</p>`;
    } else {
      subject = `Il centro ha una proposta per te: ${activityName}`;
      body = `<p>${greeting}</p><p>Il centro ha inviato una proposta alternativa per ${forWhat}:</p><p>${proposalNote ?? ""}</p>`;
    }
    const result = await sendEmail({ to: parentRow.email, subject, html: body });
    if (result.error) {
      console.error(
        `[booking-response] Notifica email al genitore fallita definitivamente dopo ${result.attempts} tentativo/i (bookingId=${bookingId}, decision=${decision}): ${result.error}`
      );
    }
    await recordEmailDeliveryStatus(
      supabase,
      bookingId,
      result.error ? "failed" : "sent",
      result.error
    );
  } catch (e) {
    // best effort — non blocca la risposta già salvata. Logghiamo comunque
    // esplicitamente (prima la catch era silenziosa, causa del debito P2).
    console.error(
      `[booking-response] Errore inatteso durante la notifica email al genitore (bookingId=${bookingId}, decision=${decision}):`,
      e
    );
  }
}
