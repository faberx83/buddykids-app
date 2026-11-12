import Link from "next/link";
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
  // ADMIN OPERATIVO (12/11/2026): "Verifica se 'Centri da attivare' e
  // 'Onboarding centri — TRAMA ONE' gestiscono lo stesso processo. Se sì,
  // consolida la coda". Verificato: stessa macchina a stati
  // (center_onboarding_state) e stesso storico. La coda di lavoro è
  // /admin/centri-attivazione (anche la card di Oggi porta lì); questa
  // pagina resta per i segnali di fiducia e la verifica d'identità con
  // documento (DEC-22, sostituita dalla spunta "referente confermato").
  return (
    <div>
      <div className="mb-4 rounded-lg border-2 border-[#E0A040] bg-[#FFF8EC] px-4 py-3 text-sm text-[#7A4500]">
        Questa è la vista di prima dello stesso processo. Per verificare e approvare i centri usa{" "}
        <Link href="/admin/centri-attivazione?f=trama" className="font-bold underline">
          Centri da attivare
        </Link>
        : stessa coda, con &quot;Tocca a TRAMA / Tocca al centro&quot;, motivo del blocco e storico.
      </div>
      <AdminOnboardingReviewClient
        initialCenters={centers}
        initialDetails={details}
        initialTrustSignals={trustSignals}
      />
    </div>
  );
}
