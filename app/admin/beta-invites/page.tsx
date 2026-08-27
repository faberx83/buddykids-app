import BetaInvitesAdminClient from "./BetaInvitesAdminClient";
import { getBetaInviteCodesForAdmin } from "@/lib/data/beta-invites";

export default async function AdminBetaInvitesPage() {
  const codes = await getBetaInviteCodesForAdmin();
  return <BetaInvitesAdminClient initialCodes={codes} />;
}
