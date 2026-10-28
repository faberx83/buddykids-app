import { getCentersForActivation } from "@/lib/data/center-activation";
import { activationView, adminBucket, canApprove, daysWaiting } from "@/lib/centers/activation";
import ActivationAdminClient, { type AdminActivationRow } from "./ActivationAdminClient";

// TRAMA — PORTALE CENTRI V2, FASE 1 (27/10/2026): Admin → Centri da attivare
// (tavola 9 del mock "TRAMA Partner V2"). Versione V2 di /admin/one/onboarding,
// che resta. I dati passano dal controllo platform_admin lato server
// (getCentersForActivation): chi non è Admin riceve un elenco vuoto.
export const dynamic = "force-dynamic";

export default async function CentriAttivazionePage() {
  const centers = await getCentersForActivation();
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
  return <ActivationAdminClient rows={rows} />;
}
