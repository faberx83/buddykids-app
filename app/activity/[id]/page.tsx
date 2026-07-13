import { notFound } from "next/navigation";
import { getActivityBySlug, getPromotionsForActivity } from "@/lib/data/activities";
import { getFavoriteActivityIds } from "@/lib/data/favorites";
import { getApprovedCertificationsForActivity } from "@/lib/data/certifications";
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
  const [promotions, favoriteIds, certifications] = await Promise.all([
    getPromotionsForActivity(activity),
    getFavoriteActivityIds(),
    getApprovedCertificationsForActivity(activity.dbId),
  ]);
  const initialFavorite = Boolean(activity.dbId && favoriteIds.has(activity.dbId));

  return (
    <PhoneShell>
      <DetailClient
        activity={activity}
        promotions={promotions}
        initialFavorite={initialFavorite}
        certifications={certifications}
      />
    </PhoneShell>
  );
}
