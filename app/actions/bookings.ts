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
// TRAMA ONE Build Sprint 6 (backlog vincolante P1, Capacity) — reserve/
// release centralizzati in lib/capacity/service.ts. Qui chiudiamo due gap
// concreti trovati leggendo questo file: (1) cancelBookingAction non
// rilasciava MAI la capacità settimanale già decrementata all'accettazione
// (perdita di posti permanente); (2) updateBookingWeeksAction cancellava/
// reinseriva booking_weeks senza mai coordinarsi con activity_weeks.spots_left
// (settimane rimosse mai rilasciate, settimane aggiunte mai riservate se la
// prenotazione era già stata accettata dal centro). Vedi migration_18.
import {
  releaseAllWeekCapacityForBooking,
  releaseWeekCapacity,
  reserveWeekCapacity,
  releaseDayCapacity,
} from "@/lib/capacity/service";
// Segnalazione Fabrizio 25/08/2026: "Modifica prenotazione" per una
// prenotazione a Giorni spot non offriva alcuna opzione di aggiungere/
// rimuovere giorni — decisione confermata da Fabrizio (AskUserQuestion):
// editor completo add+remove. dayPrice è la STESSA funzione pura già usata
// da BookingClient.tsx alla creazione — nessuna doppia formula di prezzo.
import { dayPrice } from "@/lib/day-pricing";
import type { DayAvailability } from "@/lib/types";

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
  id: string;
  price_per_week: number | null;
  shuttle_price: number | null;
  centers: RawCenterRef | RawCenterRef[] | null;
}

// Segnalazione Fabrizio 25/08/2026 — estensione additiva per l'editor add/
// remove giorni: activities.id (serve per interrogare activity_days
// dell'attività GIUSTA, mai fidandosi di un id passato dal client) e
// booking_days (giorni ATTUALMENTE prenotati, con il prezzo già congelato e
// lo stato di decremento capacità — necessari sia per il calcolo della
// finestra di preavviso sui giorni sia per il diff aggiunte/rimozioni).
interface RawBookingDayRef {
  activity_day_id: string;
  price: number;
  capacity_decremented: boolean;
  activity_days: { date: string } | { date: string }[] | null;
}

interface BookingMutationRow {
  id: string;
  parent_id: string;
  status: string;
  partner_decision: string | null;
  shuttle_included: boolean;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { week_id: string; activity_weeks: { start_date: string } | { start_date: string }[] | null }[] | null;
  booking_days: RawBookingDayRef[] | null;
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
      "id, parent_id, status, partner_decision, shuttle_included, activities ( id, price_per_week, shuttle_price, centers ( cancellation_window_days, multiweek_discount_percent, family_discount_tiers ) ), booking_weeks ( week_id, activity_weeks ( start_date ) ), booking_days ( activity_day_id, price, capacity_decremented, activity_days ( date ) ), booking_kids ( kid_id )"
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

// Stessa identica logica di checkCancellationWindow sopra, ma verso il PRIMO
// giorno singolo ATTUALMENTE prenotato (booking_days/activity_days.date)
// invece della prima settimana — serve per updateBookingDaysAction
// (l'equivalente per giorni di updateBookingWeeksAction). Funzione separata
// invece di generalizzare quella sopra: i due branch leggono strutture dati
// diverse (activity_weeks.start_date vs activity_days.date) e tenerle
// distinte evita di introdurre un parametro generico che renderebbe meno
// leggibile checkCancellationWindow per il caso, più comune, delle settimane.
function checkCancellationWindowForDays(
  row: BookingMutationRow,
  todayIso: string
): { allowed: boolean; reason?: string } {
  const activity = firstOf(row.activities);
  const center = firstOf(activity?.centers ?? null);
  const windowDays = center?.cancellation_window_days ?? 3;

  const dayDates = (row.booking_days ?? [])
    .map((bd) => firstOf(bd.activity_days)?.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const firstDate = dayDates[0];
  if (!firstDate) return { allowed: true };

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.round(
    (new Date(firstDate + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) / msPerDay
  );

  if (daysUntil < windowDays) {
    return {
      allowed: false,
      reason:
        daysUntil >= 0
          ? `Puoi annullare/modificare solo fino a ${windowDays} giorni prima dell'inizio (mancano ${daysUntil} giorni) — contatta il centro.`
          : "Il primo giorno prenotato è già passato — contatta direttamente il centro per annullare o modificare.",
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

  // Rilascio capacità PRIMA dello status update: releaseAllWeekCapacityForBooking
  // legge/scrive booking_weeks.capacity_decremented, che deve ancora esistere
  // e riflettere lo stato pre-annullamento (nessuna riga viene eliminata qui,
  // solo bookings.status cambia — booking_weeks resta intatta per lo storico).
  await releaseAllWeekCapacityForBooking(supabase, bookingId);

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

  // Se il centro ha già accettato la prenotazione, le vecchie settimane
  // possono avere activity_weeks.spots_left già decrementata
  // (booking_weeks.capacity_decremented=true) — va rilasciata PRIMA di
  // cancellare le righe booking_weeks, altrimenti quel posto va perso per
  // sempre (stesso bug di cancelBookingAction, qui sulla modifica invece che
  // sull'annullamento). Se non ancora accettata, non è mai stata decrementata
  // e releaseWeekCapacity è un no-op idempotente.
  const alreadyAccepted = row.partner_decision === "accepted";
  if (alreadyAccepted) {
    for (const bw of row.booking_weeks ?? []) {
      await releaseWeekCapacity(supabase, input.bookingId, bw.week_id);
    }
  }

  const { error: delError } = await supabase
    .from("booking_weeks")
    .delete()
    .eq("booking_id", input.bookingId);
  if (delError) return { error: delError.message };

  const { error: insError } = await supabase
    .from("booking_weeks")
    .insert(input.weekIds.map((weekId) => ({ booking_id: input.bookingId, week_id: weekId })));
  if (insError) return { error: insError.message };

  // Specularmente: se la prenotazione era già accettata, le NUOVE settimane
  // vanno riservate subito (altrimenti resterebbero capacity_decremented=false
  // per sempre, un posto mai conteggiato). Se non ancora accettata, la
  // riserva reale avviene più avanti in respondToBookingAction — qui
  // non forziamo nulla di prematuro.
  if (alreadyAccepted) {
    for (const weekId of input.weekIds) {
      await reserveWeekCapacity(supabase, input.bookingId, weekId);
    }
  }

  const { error: updError } = await supabase
    .from("bookings")
    .update({ total_amount: total, discount_amount: groupDiscount })
    .eq("id", input.bookingId);
  if (updError) return { error: updError.message };

  revalidatePath("/prenotazioni");
  revalidatePath("/center/attendance");
  return {};
}

// ─────────────────────────────────────────────────────────────────────────
// Modifica giorni di una prenotazione "Giorni spot" (booking_days) —
// richiesta di Fabrizio dopo la chiusura "onesta" di task #585 ("la modifica
// delle date non è ancora supportata"): "vorrei capire... qual è il processo
// ipotizzato?" → decisione esplicita (AskUserQuestion): editor completo,
// aggiunta E rimozione di giorni singoli, non solo annulla.
//
// Stesso pattern strutturale di updateBookingWeeksAction sopra (nuova
// selezione COMPLETA di id, diff calcolato qui), con 2 differenze
// deliberate dovute al modello dati reale di booking_days (diverso da
// booking_weeks):
//  1. Il prezzo di un giorno è CONGELATO al momento della prenotazione
//     (booking_days.price, vedi commento in migration_12) proprio per non
//     essere ricalcolato se il Gestore cambia lo sconto del giorno in
//     seguito — quindi per i giorni GIA' prenotati che restano selezionati
//     riusiamo il prezzo già congelato, MAI ricalcolato da capo; solo i
//     giorni NUOVI (aggiunti ora) ottengono un prezzo fresco (dayPrice(),
//     stessa formula di BookingClient.tsx alla creazione).
//  2. L'accettazione/capacità è PER SINGOLO GIORNO (booking_days.
//     partner_decision + capacity_decremented — migration_13, DEC-42), non
//     un unico flag a livello di intera prenotazione come per le settimane:
//     un giorno appena aggiunto parte sempre "pending"/non decrementato
//     (identico a un giorno scelto alla creazione, mai un'accettazione
//     automatica solo perché altri giorni della stessa prenotazione erano
//     già stati accettati dal centro); un giorno rimosso rilascia la
//     capacità SOLO se era stata davvero decrementata per QUEL giorno.
export interface UpdateBookingDaysInput {
  bookingId: string;
  activityDayIds: string[]; // nuova selezione COMPLETA di giorni (activity_days.id)
}

export async function updateBookingDaysAction(
  input: UpdateBookingDaysInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.activityDayIds.length === 0) {
    return { error: "Seleziona almeno un giorno (per annullare del tutto usa \"Annulla prenotazione\")" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const row = await loadBookingForMutation(supabase, input.bookingId, user.id);
  if (!row) return { error: "Prenotazione non trovata" };
  if (row.status === "cancelled") return { error: "Questa prenotazione è stata annullata" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const windowCheck = checkCancellationWindowForDays(row, todayIso);
  if (!windowCheck.allowed) return { error: windowCheck.reason };

  const activity = firstOf(row.activities);
  const center = firstOf(activity?.centers ?? null);
  if (!activity) return { error: "Attività non trovata" };

  const currentDays = row.booking_days ?? [];
  const currentDayIds = new Set(currentDays.map((bd) => bd.activity_day_id));
  const requestedIds = new Set(input.activityDayIds);

  const keptDays = currentDays.filter((bd) => requestedIds.has(bd.activity_day_id));
  const removedDays = currentDays.filter((bd) => !requestedIds.has(bd.activity_day_id));
  const newlyAddedIds = input.activityDayIds.filter((id) => !currentDayIds.has(id));

  // Validazione dei SOLI giorni nuovi contro l'attività reale (mai fidarsi
  // di un id passato dal client): devono appartenere a QUESTA attività,
  // essere aperti/prenotabili singolarmente, avere posti liberi, e non
  // essere nel passato — stesso filtro già applicato in DetailClient.tsx
  // (task #584) per il calendario Giorni spot.
  let newlyAddedRows: { id: string; date: string; discount_percent: number | null }[] = [];
  if (newlyAddedIds.length > 0) {
    const { data: candidateDays, error: candErr } = await supabase
      .from("activity_days")
      .select("id, date, is_open, single_day_bookable, spots_left, discount_percent")
      .eq("activity_id", activity.id)
      .in("id", newlyAddedIds);
    if (candErr) return { error: candErr.message };

    const invalid = (candidateDays ?? []).filter(
      (d) => !d.is_open || !d.single_day_bookable || d.spots_left <= 0 || d.date < todayIso
    );
    if (invalid.length > 0) {
      return { error: "Uno o più giorni scelti non sono più disponibili — ricarica la pagina e riprova." };
    }
    const foundIds = new Set((candidateDays ?? []).map((d) => d.id));
    const missing = newlyAddedIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return { error: "Uno o più giorni scelti non appartengono a questa attività." };
    }
    newlyAddedRows = candidateDays ?? [];
  }

  // Rilascio capacità dei giorni RIMOSSI, solo se era stata davvero
  // decrementata per quel giorno (accettazione Partner revocata dalla
  // rimozione) — stessa logica di cancelBookingDayAction
  // (app/actions/booking-response.ts), qui inline perché operiamo su un set
  // di giorni in blocco invece che uno alla volta.
  for (const bd of removedDays) {
    if (bd.capacity_decremented) {
      await releaseDayCapacity(supabase, input.bookingId, bd.activity_day_id);
    }
  }

  if (removedDays.length > 0) {
    const { error: delError } = await supabase
      .from("booking_days")
      .delete()
      .eq("booking_id", input.bookingId)
      .in(
        "activity_day_id",
        removedDays.map((bd) => bd.activity_day_id)
      );
    if (delError) return { error: delError.message };
  }

  // Prezzo FRESCO solo per i giorni nuovi — mai ricalcolato per quelli
  // mantenuti (il loro booking_days.price resta il valore già congelato,
  // non toccato da questo insert). partner_decision/capacity_decremented
  // restano ai default di colonna ('pending'/false, migration_13) — nessuna
  // riserva automatica di capacità qui, esattamente come un giorno scelto
  // alla creazione (createBookingAction).
  const newRowsToInsert = newlyAddedRows.map((d) => {
    const dayForPricing: Pick<DayAvailability, "date" | "discountPercent"> = {
      date: d.date,
      discountPercent: d.discount_percent ?? undefined,
    };
    return {
      booking_id: input.bookingId,
      activity_day_id: d.id,
      price: dayPrice(dayForPricing as DayAvailability, activity.price_per_week ?? 0),
    };
  });
  if (newRowsToInsert.length > 0) {
    const { error: insError } = await supabase.from("booking_days").insert(newRowsToInsert);
    if (insError) return { error: insError.message };
  }

  // Ricalcolo totale: stessa formula di BookingClient.tsx per Giorni spot
  // (perChildSubtotal = somma prezzi giorno, MAI moltiplicato per i bambini
  // dentro booking_days.price — la moltiplicazione avviene solo qui, a
  // livello di prenotazione). Nessuno sconto multi-settimana (non si
  // applica a Giorni spot) né sconto invito (stesso compromesso già
  // documentato sopra in updateBookingWeeksAction per le settimane: non
  // ricalcolato in fase di modifica "di test").
  const keptPrices = keptDays.map((bd) => bd.price);
  const newPrices = newRowsToInsert.map((r) => r.price);
  const perChildSubtotal = [...keptPrices, ...newPrices].reduce((sum, p) => sum + p, 0);
  const kidsCount = Math.max(1, (row.booking_kids ?? []).length);
  const subtotal = perChildSubtotal * kidsCount;
  const familyTiers = buildFamilyTiers(center?.family_discount_tiers ?? null);
  const familyDiscount = familyDiscountAmount(perChildSubtotal, kidsCount, familyTiers);
  const total = subtotal - familyDiscount;

  const { error: updError } = await supabase
    .from("bookings")
    .update({ total_amount: total, discount_amount: familyDiscount })
    .eq("id", input.bookingId);
  if (updError) return { error: updError.message };

  revalidatePath("/prenotazioni");
  revalidatePath("/center/attendance");
  revalidatePath("/center/prenotazioni");
  return {};
}
