"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface CreateBookingInput {
  activityDbId: string;
  weekIds: string[];
  kidIds: string[];
  totalAmount: number;
  discountAmount: number;
  shuttleIncluded: boolean;
  paymentMethod: "card" | "apple_pay" | "bank_transfer";
  // Se presente, lo sconto invito è stato incluso nel totale mostrato al
  // genitore: dopo aver creato la prenotazione lo segniamo "usato" (una sola
  // volta, via RPC security definer redeem_invite_discount — vedi schema.sql)
  // così non può essere applicato di nuovo a una prenotazione successiva.
  inviteId?: string;
}

export async function createBookingAction(
  input: CreateBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      parent_id: user.id,
      activity_id: input.activityDbId,
      status: "confirmed",
      payment_method: input.paymentMethod,
      total_amount: input.totalAmount,
      discount_amount: input.discountAmount,
      shuttle_included: input.shuttleIncluded,
    })
    .select("id")
    .single();

  if (error || !booking) return { error: error?.message || "Errore nella prenotazione" };

  const bookingId: string = booking.id;

  if (input.weekIds.length > 0) {
    // Solo id "reali" (uuid) hanno senso come week_id — negli scenari mock
    // (es. "w1") l'insert su booking_weeks fallirebbe la validazione uuid,
    // quindi la saltiamo silenziosamente in quel caso.
    const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
    const realWeekIds = input.weekIds.filter(isUuid);
    if (realWeekIds.length > 0) {
      await supabase
        .from("booking_weeks")
        .insert(realWeekIds.map((weekId) => ({ booking_id: bookingId, week_id: weekId })));
    }
  }

  if (input.kidIds.length > 0) {
    const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
    const realKidIds = input.kidIds.filter(isUuid);
    if (realKidIds.length > 0) {
      await supabase
        .from("booking_kids")
        .insert(realKidIds.map((kidId) => ({ booking_id: bookingId, kid_id: kidId })));
    }
  }

  if (input.inviteId) {
    // Best-effort: se fallisce (es. già usato altrove, o scaduto nel
    // frattempo) non annulliamo la prenotazione appena creata — al peggio lo
    // sconto invito non risulta "consumato" e non verrà più riofferto in
    // automatico su prenotazioni successive di questo genitore.
    await supabase.rpc("redeem_invite_discount", { p_invite_id: input.inviteId });
  }

  return { bookingId };
}
