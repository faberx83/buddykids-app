import { redirect } from "next/navigation";
import GroupRequestsClient from "./GroupRequestsClient";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

export default async function GroupRequestsPage() {
  // Portale centri V2 (29/10/2026): le richieste di gruppo stanno nell'elenco unico di Richieste.
  if (await partnerShellEnabledForCurrentUser()) redirect("/center/prenotazioni?tipo=gruppi");
  const requests = await getGroupRequestsForCenter();
  return <GroupRequestsClient initialRequests={requests} />;
}
