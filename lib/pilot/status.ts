// TRAMA — Wave 1 "Pilot Observability": logica pura di derivazione dello
// stato sintetico per-utente, estratta da lib/data/pilot-users.ts (che ha
// "import server-only" ed è quindi non importabile in Node puro fuori dal
// bundler di Next.js) — stesso principio già stabilito in questo progetto
// per lib/command-center/priority.ts (vs lib/data/command-center.ts) e
// lib/telemetry/known-events.ts (vs lib/telemetry/events.ts): la logica
// pura vive qui, senza alcuna dipendenza I/O, così un test Playwright "no
// browser" può importarla direttamente.

export type PilotOnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";

export type PilotStatus = "invited_registered" | "onboarding" | "activated" | "returning" | "not_yet_active";

/**
 * Stato sintetico — MAI persistito, ricalcolato ad ogni lettura. Regola
 * (documentata anche in TRAMA_PILOT_OBSERVABILITY_COORDINATION_IMPLEMENTATION.md,
 * per evitare di "inventare" precisione che i dati non hanno):
 *
 * 1. Nessuna attività significativa ancora:
 *    - onboarding non iniziato       -> INVITED_REGISTERED
 *    - onboarding in corso           -> ONBOARDING
 *    - onboarding completato/saltato -> NOT_YET_ACTIVE (ha finito il
 *      carousel ma non ha ancora fatto nulla di operativo — segnale di
 *      attenzione, non solo "appena arrivato")
 * 2. Almeno un'attività significativa:
 *    - un accesso reale (last_sign_in_at) avvenuto almeno 1 giorno dopo la
 *      prima attività -> RETURNING (è tornato, non solo "ha cliccato una
 *      volta e basta")
 *    - altrimenti -> ACTIVATED
 */
export function computePilotStatus(
  onboardingStatus: PilotOnboardingStatus,
  firstMeaningfulActionAt: string | null,
  lastSignInAt: string | null
): PilotStatus {
  if (!firstMeaningfulActionAt) {
    if (onboardingStatus === "not_started") return "invited_registered";
    if (onboardingStatus === "in_progress") return "onboarding";
    return "not_yet_active"; // completed | skipped
  }
  if (lastSignInAt) {
    const gapDays = (new Date(lastSignInAt).getTime() - new Date(firstMeaningfulActionAt).getTime()) / 86_400_000;
    if (gapDays >= 1) return "returning";
  }
  return "activated";
}
