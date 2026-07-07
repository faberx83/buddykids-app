import GroupsClient from "@/components/GroupsClient";
import { getGroupsForUser } from "@/lib/data/groups";

export default async function GroupsPage() {
  const groups = await getGroupsForUser();
  return <GroupsClient initialGroups={groups} />;
}
