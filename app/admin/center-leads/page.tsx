import CenterLeadsAdminClient from "./CenterLeadsAdminClient";
import { getAllCenterLeadsForAdmin, getCentersForClaimPicker } from "@/lib/data/center-leads";

// ADMIN OPERATIVO (12/11/2026): ?tipo=candidature | segnalazioni | tutte
// sceglie la scheda iniziale, così le card di Oggi aprono la lista giusta.
export default async function AdminCenterLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tipo = sp.tipo === "segnalazioni" ? "referral" : sp.tipo === "tutte" ? "all" : "candidacy";
  const [leads, centers] = await Promise.all([getAllCenterLeadsForAdmin(), getCentersForClaimPicker()]);
  return <CenterLeadsAdminClient initialLeads={leads} centers={centers} initialKind={tipo} />;
}
