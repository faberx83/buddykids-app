import { notFound } from "next/navigation";
import ActivityEditForm from "./ActivityEditForm";
import { getActivityBySlug } from "@/lib/data/activities";
import { getTags } from "@/lib/data/tags";
import { getCertificationsForActivityGestore } from "@/lib/data/certifications";

export default async function CenterActivityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [activity, tags] = await Promise.all([getActivityBySlug(id), getTags()]);
  if (!activity) return notFound();

  const certifications = await getCertificationsForActivityGestore(activity.dbId);

  return <ActivityEditForm activity={activity} tags={tags} certifications={certifications} />;
}
