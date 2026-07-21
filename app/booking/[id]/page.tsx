import { notFound, redirect } from "next/navigation";
import { getActivityBySlug } from "@/lib/data/activities";
import { getWeeksForActivity, getBookedWeekIdsForActivity } from "@/lib/data/weeks";
import { getKidsForUser } from "@/lib/data/kids";
import { getEligibleInviteDiscount } from "@/lib/data/invites";
import { getActivityDays } from "@/lib/data/activity-days";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import BookingClient from "./BookingClient";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kid?: string }>;
}) {
  const { id } = await params;
  // ?kid= (arrivato da "Aggiungi [bambino]" nel Planner, o dal genitore
  // selezionato in Home/Cerca): se presente, "già prenotata" è calcolato
  // SOLO per questo bambino (vedi getBookedWeekIdsForActivity) — altrimenti
  // una settimana già coperta per UN fratello risulterebbe bloccata anche
  // per l'altro che invece va aggiunto.
  const { kid: requestedKidId } = await searchParams;

  // Prenotare scrive davvero su Supabase (bookings/booking_weeks/booking_kids)
  // legato all'utente autenticato: qui, a differenza del dettaglio attività,
  // richiediamo il login prima di entrare nel flusso.
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/booking/${id}`);
  }

  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();

  // TRAMA ONE Build Sprint 3 — "Giorni spot": stessa condizione della
  // scheda attività (app/activity/[id]/page.tsx) — solo per attività dove il
  // Gestore l'ha configurata, invariato per tutte le altre.
  const wantsDayAvailability = activity.bookingMode && activity.bookingMode !== "week_only";

  const [weeks, kids, bookedWeekIdsSet, inviteDiscount, days] = await Promise.all([
    getWeeksForActivity(activity),
    getKidsForUser(),
    activity.dbId
      ? getBookedWeekIdsForActivity(activity.dbId, requestedKidId)
      : Promise.resolve(new Set<string>()),
    getEligibleInviteDiscount(),
    wantsDayAvailability ? getActivityDays(activity) : Promise.resolve([]),
  ]);
  const bookedWeekIds = Array.from(bookedWeekIdsSet);

  return (
    <PhoneShell>
      <BookingClient
        activity={activity}
        weeks={weeks}
        kids={kids}
        bookedWeekIds={bookedWeekIds}
        inviteDiscount={inviteDiscount}
        days={days}
      />
    </PhoneShell>
  );
}
