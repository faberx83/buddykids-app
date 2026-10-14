// TRAMA — ONBOARDING V2 (14/10/2026). "Prima azione utile": l'invito ad
// aggiungere TRAMA alla schermata Home non compare più al primo accesso, ma
// dopo che la famiglia ha fatto qualcosa di concreto (un impegno aggiunto,
// un'attività salvata o messa nel Planner, chi porta/chi riprende deciso,
// una prenotazione). Solo lato client, nel browser di chi usa l'app: nessun
// dato nuovo sul server, nessuna migration.
//
// Usato da components/InstallPrompt.tsx (prop waitForFirstAction, accesa con
// ONBOARDING_V2_ENABLED) e dai punti in cui l'azione riesce.

export const FIRST_ACTION_STORAGE_KEY = "trama_first_useful_action";
export const FIRST_ACTION_EVENT = "trama:first-useful-action";

export type FirstUsefulAction = "impegno" | "salvata" | "nel_planner" | "chi_porta" | "prenotazione";

/** true se in questo browser la famiglia ha già fatto un'azione utile. */
export function hasDoneFirstUsefulAction(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIRST_ACTION_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Da chiamare quando un'azione utile è riuscita. Idempotente. */
export function markFirstUsefulAction(kind: FirstUsefulAction): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FIRST_ACTION_STORAGE_KEY) !== null) return;
    window.localStorage.setItem(FIRST_ACTION_STORAGE_KEY, kind);
  } catch {
    // storage non disponibile (navigazione privata): l'evento basta per questa sessione
  }
  try {
    window.dispatchEvent(new CustomEvent(FIRST_ACTION_EVENT, { detail: kind }));
  } catch {
    // ambienti senza CustomEvent: nessun invito, nessun errore
  }
}
