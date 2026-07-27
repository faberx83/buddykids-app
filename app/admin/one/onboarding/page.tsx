import AdminOnboardingReviewClient from "./AdminOnboardingReviewClient";
import { listCentersForAdminReview, getIdentityVerification, getOnboardingAuditLog } from "@/lib/onboarding/data";
import { getTrustSignalsForCenters } from "@/lib/data/trust-signals";

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
  const [details, trustSignalsMap] = await Promise.all([
    Promise.all(
      centers.map(async (c) => ({
        centerId: c.centerId,
        identity: await getIdentityVerification(c.centerId),
        auditLog: await getOnboardingAuditLog(c.centerId),
      }))
    ),
    // Gap P1 (PT-MVP-11/A-MVP-07, trust telemetry minima): segnali grezzi
    // Admin-only, nessuno score o "Partnership Level" — vedi
    // lib/data/trust-signals.ts per il vincolo esplicito.
    getTrustSignalsForCenters(centers.map((c) => c.centerId)),
  ]);
  const trustSignals = Array.from(trustSignalsMap.values());
  return (
    <AdminOnboardingReviewClient
      initialCenters={centers}
      initialDetails={details}
      initialTrustSignals={trustSignals}
    />
  );
}
