import { notFound } from "next/navigation";
import GroupDetailClient from "@/components/GroupDetailClient";
import { getGroupDetail } from "@/lib/data/group-detail";
import { getActivities } from "@/lib/data/activities";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getGroupDetail(id);
  if (!detail) notFound();

  // La lista attività (per collegare il gruppo a un campo) serve solo a chi
  // ha creato il gruppo e non l'ha ancora collegato — evitiamo di caricarla
  // inutilmente negli altri casi.
  const activityOptions =
    isSupabaseConfigured && detail.createdByMe && !detail.activityId
      ? (await getActivities())
          .filter((a) => a.dbId)
          .map((a) => ({ dbId: a.dbId as string, name: a.name, center: a.center }))
      : [];

  return <GroupDetailClient detail={detail} activityOptions={activityOptions} />;
}
