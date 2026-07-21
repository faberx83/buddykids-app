"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

export interface CreateBookingInput {
  activityDbId: string;
  weekIds: string[];
  kidIds: string[];
  // TRAMA ONE Build Sprint 3 — "Giorni spot": presente SOLO quando il
  // genitore ha prenotato giorni singoli invece di settimane intere
  // (weekIds resta [] in quel caso). Ogni voce è un activity_days.id +
  // il prezzo di QUEL giorno già calcolato (lib/day-pricing.ts), da
  // congelare in booking_days.price (vedi migration_12).
  dayBookings?: { activityDayId: string; price: number }[];
  totalAmount: number;
  discountAmount: number;
  shuttleIncluded: boolean;
  paymentMethod: "card" | "apple_pay" | "bank_transfer";
  // Se presente, lo sconto invito è stato incluso nel totale mostrato al
  // genitore: dopo aver creato la prenotazione lo segniamo "usato" (una sola
  // volta, via RPC security definer redeem_invite_discount — vedi schema.sql)
  // così non può essere applicato di nuovo a una prenotazione successiva.
  inviteId?: string;
  // Richiesta di Fabrizio: "bisogna aggiungere un controllo sulle
  // prenotazioni per evitare di farne multiple su diverse attività nella
  // stessa settimana". Avviso con conferma (non bloccante): la prima
  // chiamata (confirmOverlap assente/false) restituisce eventuali conflitti
  // SENZA creare la prenotazione; se il genitore conferma comunque, il
  // client richiama l'azione con confirmOverlap:true per procedere davvero
  // (alcune famiglie vogliono più attività nella stessa settimana, es.
  // mattina/pomeriggio — per questo non è un blocco rigido).
  confirmOverlap?: boolean;
}

export interface BookingWeekConflict {
  kidName: string;
  otherActivityName: string;
  weekLabel: string;
  // SPRINT CORRETTIVO (feedback Fabrizio: "sullo stesso bambino forse va
  // introdotto un check più stringente") — serve a costruire la scelta
  // esplicita "Annulla l'altra e prenota questa" invece del generico
  // "Prosegui comunque": id della prenotazione ESISTENTE in conflitto, da
  // passare a cancelBookingAction se l'utente sceglie di sostituirla.
  otherBookingId: string;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

// Cerca, tra le prenotazioni ATTIVE del genitore su ALTRE attività, eventuali
// bambini già impegnati in una settimana che si sovrappone a quelle appena
// scelte — nessuna nuova tabella, solo lettura incrociata di bookings/
// booking_kids/booking_weeks già esistenti (stesso principio già usato per
// "famiglie già iscritte" nelle Community).
async function findWeekOverlapConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  activityDbId: string,
  weekIds: string[],
  kidIds: string[]
): Promise<BookingWeekConflict[]> {
  const realWeekIds = weekIds.filter(isUuid);
  const realKidIds = kidIds.filter(isUuid);
  if (realWeekIds.length === 0 || realKidIds.length === 0) return [];

  const { data: newWeeksData } = await supabase
    .from("activity_weeks")
    .select("id, start_date, end_date")
    .in("id", realWeekIds);
  const newWeekRanges = (newWeeksData ?? []) as { id: string; start_date: string; end_date: string }[];
  if (newWeekRanges.length === 0) return [];

  const { data: otherBookings } = await supabase
    .from("bookings")
    .select(
      "id, activities ( name ), booking_kids ( kid_id, kids ( name ) ), booking_weeks ( activity_weeks ( start_date, end_date ) )"
    )
    .eq("parent_id", userId)
    .neq("status", "cancelled")
    .neq("activity_id", activityDbId);
  if (!otherBookings || otherBookings.length === 0) return [];

  function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }

  const seasonWeeks = getSeasonWeekRanges(await getSeasonYear());
  function canonicalLabel(startDate: string, endDate: string): string {
    const match = seasonWeeks.find((sw) =>
      overlaps(startDate, endDate, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
    );
    return match ? `Settimana ${match.index}` : "";
  }

  interface RawOtherBooking {
    id: string;
    activities: { name: string } | { name: string }[] | null;
    booking_kids: { kid_id: string; kids: { name: string } | { name: string }[] | null }[] | null;
    booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  }

  const conflicts: BookingWeekConflict[] = [];
  const seen = new Set<string>();

  for (const row of otherBookings as unknown as RawOtherBooking[]) {
    const sharedKidRows = (row.booking_kids ?? []).filter((bk) => realKidIds.includes(bk.kid_id));
    if (sharedKidRows.length === 0) continue;

    const otherWeekRanges = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is { start_date: string; end_date: string } => Boolean(w));

    for (const newWeek of newWeekRanges) {
      const overlappingOtherWeek = otherWeekRanges.find((ow) =>
        overlaps(newWeek.start_date, newWeek.end_date, ow.start_date, ow.end_date)
      );
      if (!overlappingOtherWeek) continue;

      const activity = firstOf(row.activities);
      const weekLabel = canonicalLabel(overlappingOtherWeek.start_date, overlappingOtherWeek.end_date);

      for (const bk of sharedKidRows) {
        const kid = firstOf(bk.kids);
        const kidName = kid?.name || "Il bambino";
        const dedupeKey = `${bk.kid_id}:${activity?.name}:${weekLabel}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        conflicts.push({
          kidName,
          otherActivityName: activity?.name || "un'altra attività",
          weekLabel: weekLabel || "questa settimana",
          otherBookingId: row.id,
        });
      }
    }
  }

  return conflicts;
}

export async function createBookingAction(
  input: CreateBookingInput
): Promise<{ bookingId?: string; error?: string; conflicts?: BookingWeekConflict[] }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  if (!input.confirmOverlap) {
    const conflicts = await findWeekOverlapConflicts(
      supabase,
      user.id,
      input.activityDbId,
      input.weekIds,
      input.kidIds
    );
    if (conflicts.length > 0) return { conflicts };
  }

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

  // TRAMA ONE Build Sprint 3 — "Giorni spot": stesso pattern di
  // booking_weeks sopra (solo id "reali" uuid, mock ignorati in silenzio).
  // Tabella booking_days additiva (migration_12) — se non ancora applicata
  // in produzione, questo insert fallisce silenziosamente (best-effort,
  // come già fatto sopra per gli altri insert secondari) senza annullare la
  // prenotazione già creata: al peggio manca il dettaglio giorno-per-giorno,
  // non la prenotazione stessa.
  if (input.dayBookings && input.dayBookings.length > 0) {
    const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
    const realDayBookings = input.dayBookings.filter((d) => isUuid(d.activityDayId));
    if (realDayBookings.length > 0) {
      await supabase.from("booking_days").insert(
        realDayBookings.map((d) => ({
          booking_id: bookingId,
          activity_day_id: d.activityDayId,
          price: d.price,
        }))
      );
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
