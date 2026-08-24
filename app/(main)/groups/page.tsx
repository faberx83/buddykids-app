import GroupsClient from "@/components/GroupsClient";
import { getGroupsForUser, getPublicGroups, getMyGroupInvites } from "@/lib/data/groups";

// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): le 3 tab
// sono ora tutte precaricate lato server (stesso pattern già usato per "I
// miei gruppi"), niente spinner/fetch client al primo cambio tab.
export default async function GroupsPage() {
  const [groups, publicGroups, invites] = await Promise.all([
    getGroupsForUser(),
    getPublicGroups(),
    getMyGroupInvites(),
  ]);
  return <GroupsClient initialGroups={groups} initialPublicGroups={publicGroups} initialInvites={invites} />;
}
