import { notFound } from "next/navigation";
import GroupDetailClient from "@/components/GroupDetailClient";
import { getGroupDetail } from "@/lib/data/group-detail";
import { getActivities } from "@/lib/data/activities";
import { getParentProfile } from "@/lib/data/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveGroupDetailBackHref } from "@/lib/nextgen/groups-back-nav";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 5) —
  // segnalazione: "dettaglio gruppo → Back → lista → Back → Planner/Gruppi"
  // si rompeva perché backHref era hardcoded a "/nextgen/groups" a
  // prescindere da come si era arrivati qui. "from" è lo stesso marcatore di
  // contesto propagato da PlannerGroupsView.tsx/app/nextgen/groups/page.tsx
  // (query string, nessun hack su browser history): se il dettaglio è stato
  // raggiunto risalendo da Planner/Gruppi, il Back deve riportare alla
  // LISTA con lo stesso contesto ancora attaccato (cosi un secondo Back da
  // lì torni a Planner/Gruppi, non solo dopo un giro casuale) — altrimenti
  // comportamento INVARIATO (backHref="/nextgen/groups" come prima).
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const [detail, parentProfile] = await Promise.all([getGroupDetail(id), getParentProfile()]);
  if (!detail) notFound();

  const activityOptions =
    isSupabaseConfigured && detail.createdByMe && !detail.activityId
      ? (await getActivities())
          .filter((a) => a.dbId)
          .map((a) => ({ dbId: a.dbId as string, name: a.name, center: a.center }))
      : [];

  const inviterName = parentProfile.fullName.trim().split(/\s+/)[0] || "";
  const backHref = resolveGroupDetailBackHref(from);

  return (
    <GroupDetailClient
      detail={detail}
      activityOptions={activityOptions}
      inviterName={inviterName}
      backHref={backHref}
      nextgen
    />
  );
}
