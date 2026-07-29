import CenterLeadsAdminClient from "./CenterLeadsAdminClient";
import { getAllCenterLeadsForAdmin, getCentersForClaimPicker } from "@/lib/data/center-leads";

export default async function AdminCenterLeadsPage() {
  const [leads, centers] = await Promise.all([getAllCenterLeadsForAdmin(), getCentersForClaimPicker()]);
  return <CenterLeadsAdminClient initialLeads={leads} centers={centers} />;
}
