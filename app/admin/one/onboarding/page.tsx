import AdminOnboardingReviewClient from "./AdminOnboardingReviewClient";
import { listCentersForAdminReview, getIdentityVerification, getOnboardingAuditLog } from "@/lib/onboarding/data";

// Dipende dalla sessione/ruolo dell'utente loggato (platform_admin) — stessa
// motivazione delle altre pagine /one già forzate a dynamic in Sprint 0.
export const dynamic = "force-dynamic";

// TRAMA ONE Build Sprint 1 — coda di revisione Admin per l'onboarding
// Centro. Raggiungibile solo se TRAMA_ONE_ENABLED è true (gate applicato dal
// layout app/admin/one/layout.tsx, che richiede già role=platform_admin per
// arrivare a /admin/one via il rewrite host-based di proxy.ts).
//
// Scala del pilot (5-10 centri beta attesi, A1 in ASSUMPTION_LOG.md): il
// dettaglio (verifica identità + audit log) viene caricato per ogni centro
// in coda direttamente qui, N+1 query accettabile a questa scala — se il
// numero di centri in coda crescesse in modo significativo, andrebbe
// spostato dietro un fetch on-demand per riga.
export default async function AdminOnboardingReviewPage() {
  const centers = await listCentersForAdminReview();
  const details = await Promise.all(
    centers.map(async (c) => ({
      centerId: c.centerId,
      identity: await getIdentityVerification(c.centerId),
      auditLog: await getOnboardingAuditLog(c.centerId),
    }))
  );
  return <AdminOnboardingReviewClient initialCenters={centers} initialDetails={details} />;
}
