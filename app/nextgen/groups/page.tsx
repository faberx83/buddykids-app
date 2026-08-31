import GroupsClient from "@/components/GroupsClient";
import { getGroupsForUser, getPublicGroups, getMyGroupInvites } from "@/lib/data/groups";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Gruppi & Community",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude il gap più
// grave del rimando legacy segnalato da Fabrizio — da qui in poi un genitore
// NEXTGEN che entra in Gruppi non finisce più dentro il layout/bottom-nav
// LEGACY (vedi components/BottomNav.tsx, "/groups" è una voce primaria
// LEGACY). basePath="/nextgen/groups" fa sì che creazione gruppo, "Unisciti"
// da Scopri e accettazione inviti restino tutte dentro NEXTGEN.
export default async function NextgenGroupsPage({
  searchParams,
}: {
  // TRAMA — Wave 3 (Notifiche): "tab=inviti" arriva dal deep link di un
  // item del Notification Center ("Sei stato invitato al gruppo...") — apre
  // direttamente la tab "Inviti" invece di "I miei gruppi" (indice di default).
  searchParams: Promise<{ tab?: string }>;
}) {
  const [groups, publicGroups, invites, params] = await Promise.all([
    getGroupsForUser(),
    getPublicGroups(),
    getMyGroupInvites(),
    searchParams,
  ]);
  return (
    <GroupsClient
      initialGroups={groups}
      initialPublicGroups={publicGroups}
      initialInvites={invites}
      basePath="/nextgen/groups"
      backHref="/nextgen/planner"
      showBrandIcon
      initialTab={params.tab === "inviti" ? 2 : undefined}
    />
  );
}
