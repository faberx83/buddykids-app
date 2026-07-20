import OnboardingClient from "./OnboardingClient";
import { getCenterContext } from "@/lib/data/center-admin";
import {
  getCenterOnboardingState,
  getChecklistCompletions,
  getIdentityVerification,
  getOnboardingAuditLog,
} from "@/lib/onboarding/data";

// Stessa motivazione di app/center/profile/page.tsx: dipende dalla sessione
// dell'utente loggato, non deve mai essere servita da cache condivisa.
export const dynamic = "force-dynamic";

// TRAMA ONE Build Sprint 1 — Onboarding Centro (Partner). Raggiungibile solo
// se TRAMA_ONE_ENABLED è risolto a true per l'utente (gate già applicato dal
// layout app/center/one/layout.tsx).
export default async function CenterOnboardingPage() {
  const { centerDbId } = await getCenterContext();

  const [state, checklist, identity, auditLog] = await Promise.all([
    getCenterOnboardingState(centerDbId),
    getChecklistCompletions(centerDbId),
    getIdentityVerification(centerDbId),
    getOnboardingAuditLog(centerDbId),
  ]);

  return (
    <OnboardingClient
      centerId={centerDbId}
      initialState={state}
      initialChecklist={checklist}
      initialIdentity={identity}
      auditLog={auditLog}
    />
  );
}
