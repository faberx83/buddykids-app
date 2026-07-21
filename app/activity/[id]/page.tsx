import { notFound } from "next/navigation";
import { getActivityBySlug, getPromotionsForActivity } from "@/lib/data/activities";
import { getFavoriteActivityIds } from "@/lib/data/favorites";
import { getApprovedCertificationsForActivity } from "@/lib/data/certifications";
import { getActivityDays } from "@/lib/data/activity-days";
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
  const [promotions, favoriteIds, certifications, days] = await Promise.all([
    getPromotionsForActivity(activity),
    getFavoriteActivityIds(),
    getApprovedCertificationsForActivity(activity.dbId),
    wantsDayAvailability ? getActivityDays(activity) : Promise.resolve([]),
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
      />
    </PhoneShell>
  );
}
