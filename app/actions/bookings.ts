"use server";

// Annullamento e modifica di una prenotazione da parte del genitore —
// richiesta esplicita di Fabrizio: "SOLO PER TESTARE la possibilità di
// modificare una prenotazione così posso verificare cosa succede lato
// gestore" + "il processo di eventuale annullamento della prenotazione: entro
// quanto si può fare? può essere una variabile gestibile da ciascun centro
// estivo?" — risposta: sì, è per-centro (centers.cancellation_window_days,
// vedi app/center/profile/CenterProfileClient.tsx), con default 3 giorni.
//
// Nota RLS: nessuna nuova policy necessaria — "bookings"/"booking_weeks" già
// concedono al genitore "for all" (select/insert/update/delete) sulle
// proprie righe (auth.uid() = parent_id, vedi supabase/schema.sql). Qui
// aggiungiamo comunque un filtro esplicito .eq("parent_id", user.id) come
// doppia sicurezza e per poter distinguere "non trovata" da "non tua".

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { buildFamilyTiers, familyDiscountAmount } from "@/lib/family-discount";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawCenterRef {
  cancellation_window_days: number | null;
  multiweek_discount_percent: number | null;
  family_discount_tiers: number[] | null;
}

interface RawActivityRef {
  price_per_week: number | null;
  shuttle_price: number | null;
  centers: RawCenterRef | RawCenterRef[] | null;
}

interface BookingMutationRow {
  id: string;
  parent_id: string;
  status: string;
  shuttle_included: boolean;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { week_id: string; activity_weeks: { start_date: string } | { start_date: string }[] | null }[] | null;
  booking_kids: { kid_id: string }[] | null;
}

async function loadBookingForMutation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  userId: string
): Promise<BookingMutationRow | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, parent_id, status, shuttle_included, activities ( price_per_week, shuttle_price, centers ( cancellation_window_days, multiweek_discount_percent, family_discount_tiers ) ), booking_weeks ( week_id, activity_weeks ( start_date ) ), booking_kids ( kid_id )"
    )
    .eq("id", bookingId)
    .eq("parent_id", userId)
    .single();

  if (error || !data) return null;
  return data as BookingMutationRow;
}

// Verifica la finestra di preavviso configurata dal centro rispetto alla
// PRIMA settimana attualmente prenotata (prima di qualunque modifica).
function checkCancellationWindow(
  row: BookingMutationRow,
  todayIso: string
): { allowed: boolean; reason?: string } {
  const activity = firstOf(row.activities);
  const center = firstOf(activity?.centers ?? null);
  const windowDays = center?.cancellation_window_days ?? 3;

  const weekStarts = (row.booking_weeks ?? [])
    .map((bw) => firstOf(bw.activity_weeks)?.start_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const firstStart = weekStarts[0];
  if (!firstStart) return { allowed: true };

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.round(
    (new Date(firstStart + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) / msPerDay
  );

  if (daysUntil < windowDays) {
    return {
      allowed: false,
      reason:
        daysUntil >= 0
          ? `Puoi annullare/modificare solo fino a ${windowDays} giorni prima dell'inizio (mancano ${daysUntil} giorni) — contatta il centro.`
          : "Questa settimana è già iniziata — contatta direttamente il centro per annullare o modificare.",
    };
  }
  return { allowed: true };
}

export async function cancelBookingAction(bookingId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const row = await loadBookingForMutation(supabase, bookingId, user.id);
  if (!row) return { error: "Prenotazione non trovata" };
  if (row.status === "cancelled") return { error: "Questa prenotazione è già stata annullata" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const windowCheck = checkCancellationWindow(row, todayIso);
  if (!windowCheck.allowed) return { error: windowCheck.reason };

  const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
  if (error) return { error: error.message };

  revalidatePath("/prenotazioni");
  revalidatePath("/center/attendance");
  return {};
}

export interface UpdateBookingWeeksInput {
  bookingId: string;
  weekIds: string[]; // nuova selezione completa di settimane (uuid)
}

export async function updateBookingWeeksAction(
  input: UpdateBookingWeeksInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.weekIds.length === 0) return { error: "Seleziona almeno una settimana" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const row = await loadBookingForMutation(supabase, input.bookingId, user.id);
  if (!row) return { error: "Prenotazione non trovata" };
  if (row.status === "cancelled") return { error: "Questa prenotazione è stata annullata" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const windowCheck = checkCancellationWindow(row, todayIso);
  if (!windowCheck.allowed) return { error: windowCheck.reason };

  const activity = firstOf(row.activities);
  const center = firstOf(activity?.centers ?? null);
  if (!activity) return { error: "Attività non trovata" };

  // Ricalcolo del prezzo con la STESSA formula usata in creazione
  // (app/booking/[id]/BookingClient.tsx): settimane × prezzo × bambini, meno
  // sconto multi-settimana e sconto famiglia, più eventuale navetta. Lo
  // sconto invito (se presente sulla prenotazione originale) non viene
  // ricalcolato qui: si applica una sola volta alla creazione — per questa
  // funzionalità di modifica "di test" richiesta da Fabrizio è un
  // compromesso accettabile, da rivedere se la modifica diventa una
  // funzionalità di prima classe per il lancio.
  const kidsCount = Math.max(1, (row.booking_kids ?? []).length);
  const nWeeks = input.weekIds.length;
  const pricePerWeek = activity.price_per_week ?? 0;
  const perChildSubtotal = nWeeks * pricePerWeek;
  const subtotal = perChildSubtotal * kidsCount;
  const multiweekPercent = center?.multiweek_discount_percent ?? 5;
  const weekDiscount = nWeeks >= 2 ? Math.round(subtotal * (multiweekPercent / 100)) : 0;
  const familyTiers = buildFamilyTiers(center?.family_discount_tiers ?? null);
  const familyDiscount = familyDiscountAmount(perChildSubtotal, kidsCount, familyTiers);
  const groupDiscount = weekDiscount + familyDiscount;
  const shuttleCost = row.shuttle_included ? (activity.shuttle_price ?? 0) * nWeeks * kidsCount : 0;
  const total = subtotal - groupDiscount + shuttleCost;

  const { error: delError } = await supabase
    .from("booking_weeks")
    .delete()
    .eq("booking_id", input.bookingId);
  if (delError) return { error: delError.message };

  const { error: insError } = await supabase
    .from("booking_weeks")
    .insert(input.weekIds.map((weekId) => ({ booking_id: input.bookingId, week_id: weekId })));
  if (insError) return { error: insError.message };

  const { error: updError } = await supabase
    .from("bookings")
    .update({ total_amount: total, discount_amount: groupDiscount })
    .eq("id", input.bookingId);
  if (updError) return { error: updError.message };

  revalidatePath("/prenotazioni");
  revalidatePath("/center/attendance");
  return {};
}
