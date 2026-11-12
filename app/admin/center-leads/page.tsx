import CenterLeadsAdminClient from "./CenterLeadsAdminClient";
import { getAllCenterLeadsForAdmin, getCentersForClaimPicker } from "@/lib/data/center-leads";
import DemoToggle from "@/components/admin/DemoToggle";
import { isDemoLead } from "@/lib/admin-ops/demo";

// ADMIN OPERATIVO (12/11/2026): ?tipo=candidature | segnalazioni | tutte
// sceglie la scheda iniziale, così le card di Oggi aprono la lista giusta.
export default async function AdminCenterLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tipo = sp.tipo === "segnalazioni" ? "referral" : sp.tipo === "tutte" ? "all" : "candidacy";
  // Retest 12/11/2026: candidature e segnalazioni di prova ("[TEST] …")
  // nascoste di default, come in Oggi; visibili con ?demo=1.
  const showDemo = sp.demo === "1";
  const [allLeads, centers] = await Promise.all([getAllCenterLeadsForAdmin(), getCentersForClaimPicker()]);
  const leads = showDemo ? allLeads : allLeads.filter((l) => !isDemoLead(l));
  const tipoParam = typeof sp.tipo === "string" ? `tipo=${sp.tipo}` : "";
  const q = (demo: boolean) => `/admin/center-leads?${[tipoParam, demo ? "demo=1" : ""].filter(Boolean).join("&")}`;
  return (
    <div>
      <DemoToggle hidden={allLeads.length - leads.length} showing={showDemo} showHref={q(true)} hideHref={q(false)} />
      <CenterLeadsAdminClient initialLeads={leads} centers={centers} initialKind={tipo} />
    </div>
  );
}
