import InvitesClient from "./InvitesClient";
import { getCenterContext } from "@/lib/data/center-admin";
import { getInvitesForCenter } from "@/lib/data/invites";

export default async function CenterInvitesPage() {
  const { centerDbId } = await getCenterContext();
  const invites = centerDbId ? await getInvitesForCenter(centerDbId) : [];
  return <InvitesClient initialInvites={invites} hasCenterId={Boolean(centerDbId)} />;
}
