import { notFound } from "next/navigation";
import { getActivityBySlug, getPromotionsForActivity } from "@/lib/data/activities";
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
  const promotions = await getPromotionsForActivity(activity);

  return (
    <PhoneShell>
      <DetailClient activity={activity} promotions={promotions} />
    </PhoneShell>
  );
}
