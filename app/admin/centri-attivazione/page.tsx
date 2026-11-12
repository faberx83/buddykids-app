import { getCentersForActivation } from "@/lib/data/center-activation";
import { activationView, adminBucket, canApprove, daysWaiting } from "@/lib/centers/activation";
import ActivationAdminClient, { type AdminActivationRow } from "./ActivationAdminClient";
import DemoToggle from "@/components/admin/DemoToggle";
import { isDemoCenter } from "@/lib/admin-ops/demo";

// TRAMA — PORTALE CENTRI V2, FASE 1 (27/10/2026): Admin → Centri da attivare
// (tavola 9 del mock "TRAMA Partner V2"). Versione V2 di /admin/one/onboarding,
// che resta. I dati passano dal controllo platform_admin lato server
// (getCentersForActivation): chi non è Admin riceve un elenco vuoto.
export const dynamic = "force-dynamic";

// ADMIN OPERATIVO (12/11/2026): ?f=trama|centro|attivi|sospesi e ?c=<id>
// aprono la coda filtrata e il centro scelto (link da "Oggi" e dal centro).
// È l'unica coda del processo di attivazione: /admin/one/onboarding legge la
// stessa macchina a stati (center_onboarding_state) e rimanda qui.
export default async function CentriAttivazionePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Retest 12/11/2026: i centri di prova (is_test_fixture o nome) sono
  // nascosti di default, come in Oggi; visibili con ?demo=1.
  const showDemo = sp.demo === "1";
  const allCenters = await getCentersForActivation();
  const centers = showDemo ? allCenters : allCenters.filter((c) => !isDemoCenter({ name: c.name, isTestFixture: c.isTestFixture }));
  const rows: AdminActivationRow[] = centers.map((c) => {
    const view = activationView(c.facts);
    return {
      centerId: c.centerId,
      name: c.name,
      city: c.city,
      source: c.source,
      adminEmails: c.adminEmails,
      bucket: adminBucket(c.facts.status),
      status: c.facts.status,
      percent: view.percent,
      checks: view.checks.map((k) => ({ label: k.label, done: k.done })),
      steps: view.steps,
      referentConfirmed: c.facts.referentConfirmed,
      activitiesChecked: c.facts.activitiesChecked,
      canApprove: canApprove(c.facts),
      waitingDays: daysWaiting(c.facts.submittedAt ?? c.createdAt),
      changesNote: c.facts.changesNote,
      history: c.history.slice(0, 12),
    };
  });
  const f = typeof sp.f === "string" ? `f=${sp.f}` : "";
  const q = (demo: boolean) => `/admin/centri-attivazione?${[f, demo ? "demo=1" : ""].filter(Boolean).join("&")}`;
  return (
    <div>
      <DemoToggle hidden={allCenters.length - centers.length} showing={showDemo} showHref={q(true)} hideHref={q(false)} />
      <ActivationAdminClient
        rows={rows}
        initialFilter={typeof sp.f === "string" ? sp.f : undefined}
        initialSelected={typeof sp.c === "string" ? sp.c : undefined}
        demo={showDemo}
      />
    </div>
  );
}
