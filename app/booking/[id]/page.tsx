import { notFound, redirect } from "next/navigation";
import { getActivityBySlug } from "@/lib/data/activities";
import { getWeeksForActivity, getBookedWeekIdsForActivity } from "@/lib/data/weeks";
import { getKidsForUser } from "@/lib/data/kids";
import { getEligibleInviteDiscount } from "@/lib/data/invites";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import BookingClient from "./BookingClient";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const [weeks, kids, bookedWeekIdsSet, inviteDiscount] = await Promise.all([
    getWeeksForActivity(activity),
    getKidsForUser(),
    activity.dbId ? getBookedWeekIdsForActivity(activity.dbId) : Promise.resolve(new Set<string>()),
    getEligibleInviteDiscount(),
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
      />
    </PhoneShell>
  );
}
