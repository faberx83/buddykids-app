import { notFound } from "next/navigation";
import { getActivityBySlug, getPromotionsForActivity } from "@/lib/data/activities";
import { getFavoriteActivityIds } from "@/lib/data/favorites";
import { getApprovedCertificationsForActivity } from "@/lib/data/certifications";
import { getActivityDays, getBookedDayDatesForActivity } from "@/lib/data/activity-days";
import PhoneShell from "@/components/PhoneShell";
import DetailClient from "./DetailClient";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();
  // TRAMA ONE Build Sprint 3: "Giorni spot" — la disponibilità giorno-per-
  // giorno serve solo per attività che NON sono a sola settimana intera
  // (bookingMode "day_only"/"mixed"). Per "week_only" (o assente = comportamento
  // storico) saltiamo del tutto la query, invariato per tutte le attività non
  // ancora configurate a Giorni spot lato Gestore.
  const wantsDayAvailability = activity.bookingMode && activity.bookingMode !== "week_only";
  const [promotions, favoriteIds, certifications, days, bookedDayDates] = await Promise.all([
    getPromotionsForActivity(activity),
    getFavoriteActivityIds(),
    getApprovedCertificationsForActivity(activity.dbId),
    wantsDayAvailability ? getActivityDays(activity) : Promise.resolve([]),
    // Segnalazione 25/08/2026 (Fabrizio): i giorni già prenotati per questa
    // attività devono distinguersi visivamente nella scheda "Giorni spot",
    // altrimenti sembra che il genitore non abbia prenotato nulla.
    wantsDayAvailability && activity.dbId
      ? getBookedDayDatesForActivity(activity.dbId)
      : Promise.resolve(new Set<string>()),
  ]);
  const initialFavorite = Boolean(activity.dbId && favoriteIds.has(activity.dbId));

  return (
    <PhoneShell>
      <DetailClient
        activity={activity}
        promotions={promotions}
        initialFavorite={initialFavorite}
        certifications={certifications}
        days={days}
        bookedDayDates={[...bookedDayDates]}
      />
    </PhoneShell>
  );
}
