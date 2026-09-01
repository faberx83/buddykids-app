import { notFound } from "next/navigation";
import GroupDetailClient from "@/components/GroupDetailClient";
import { getGroupDetail } from "@/lib/data/group-detail";
import { getActivities } from "@/lib/data/activities";
import { getParentProfile } from "@/lib/data/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per il dettaglio Gruppo,
// stesso pattern di app/nextgen/prenotazioni (task #524): stessa identica
// logica server-side di app/(main)/groups/[id]/page.tsx, unica differenza è
// backHref="/nextgen/groups" passato a GroupDetailClient così il link
// "Gruppi" in alto non riporta più dentro il layout LEGACY.
//
// Segnalazione di Fabrizio (01/09/2026, "dentro i gruppi è rimasta grafica
// legacy"): il componente era riusato COSÌ COM'ERA (accento sky, niente
// Poppins) — ora nextgen=true attiva la variante di stile violetta/Poppins
// (vedi GroupDetailClient.tsx), stesso principio già usato per CoverageStrip
// in app/(main)/prenotazioni/PrenotazioniClient.tsx.
export default async function NextgenGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, parentProfile] = await Promise.all([getGroupDetail(id), getParentProfile()]);
  if (!detail) notFound();

  const activityOptions =
    isSupabaseConfigured && detail.createdByMe && !detail.activityId
      ? (await getActivities())
          .filter((a) => a.dbId)
          .map((a) => ({ dbId: a.dbId as string, name: a.name, center: a.center }))
      : [];

  const inviterName = parentProfile.fullName.trim().split(/\s+/)[0] || "";

  return (
    <GroupDetailClient
      detail={detail}
      activityOptions={activityOptions}
      inviterName={inviterName}
      backHref="/nextgen/groups"
      nextgen
    />
  );
}
