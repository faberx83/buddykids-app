import { notFound } from "next/navigation";
import ActivityEditForm from "./ActivityEditForm";
import { getActivityBySlug } from "@/lib/data/activities";
import { getTags } from "@/lib/data/tags";
import { getCertificationsForActivityGestore } from "@/lib/data/certifications";

// Forza il render dinamico per-richiesta: subito dopo "Crea attività" si
// arriva qui via router.push con uno slug appena inserito su Supabase — la
// pagina non deve mai servire una risposta cache-ata/prerenderata che non
// conosce ancora la nuova riga. Difensivo, aggiunto durante l'indagine sul
// 404 segnalato da Fabrizio dopo la creazione di un'attività di test.
export const dynamic = "force-dynamic";

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
