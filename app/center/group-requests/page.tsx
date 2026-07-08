import GroupRequestsClient from "./GroupRequestsClient";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";

export default async function GroupRequestsPage() {
  const requests = await getGroupRequestsForCenter();
  return <GroupRequestsClient initialRequests={requests} />;
}
