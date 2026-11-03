import { notFound } from "next/navigation";
import ActivityEditForm from "./ActivityEditForm";
import { getActivityBySlug } from "@/lib/data/activities";
import { getTags } from "@/lib/data/tags";
import { getCertificationsForActivityGestore } from "@/lib/data/certifications";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";
import ActivityEditV2 from "@/components/center/ActivityEditV2";
import { partnerSelectableTags } from "@/lib/centers/activity-edit-v2";
import { getActivityDateSummaries, EMPTY_DATE_SUMMARY } from "@/lib/data/activity-dates";

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
  const [activity, allTags] = await Promise.all([getActivityBySlug(id), getTags()]);
  if (!activity) return notFound();
  // UX-PARTNER-005: niente tag di prova proposti al centro (quelli già assegnati restano).
  const tags = partnerSelectableTags(allTags, activity.tagIds);

  const [certifications, v2] = await Promise.all([
    getCertificationsForActivityGestore(activity.dbId),
    partnerShellEnabledForCurrentUser(),
  ]);

  // Portale centri V2 (30/10/2026, tavola 7): la scheda è un elenco di righe,
  // ogni riga apre solo i suoi campi (components/center/ActivityEditV2.tsx);
  // indirizzo con i suggerimenti (ricerca luoghi aperta ai gestori col
  // guscio, app/api/places/search/route.ts). Senza guscio il modulo di sempre.
  if (v2) {
    const dates = activity.dbId ? ((await getActivityDateSummaries([activity.dbId]))[activity.dbId] ?? EMPTY_DATE_SUMMARY) : EMPTY_DATE_SUMMARY;
    return <ActivityEditV2 activity={activity} tags={tags} certifications={certifications} dates={dates} placeSearch />;
  }
  return <ActivityEditForm activity={activity} tags={tags} certifications={certifications} />;
}
