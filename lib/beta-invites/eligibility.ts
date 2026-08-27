// Codici invito Beta (migration_30_beta_invite_codes.sql) — logica PURA di
// "questo codice è ancora utilizzabile?", separata dalla query SQL apposta
// per essere testabile senza database (stesso principio già usato per
// lib/data/planner.ts#firstUncoveredWeekIndex e lib/data/feature-flag-
// overrides.ts#computeOverrideStatus). La stessa condizione è verificata
// ANCHE lato DB dentro handle_new_user()/get_beta_invite_preview() — questa
// funzione non sostituisce quel controllo (che resta l'unica fonte di
// verità per l'iscrizione reale), serve solo per l'Admin UI (es. per
// mostrare "esaurito"/"scaduto" senza dover ricalcolare la stessa logica in
// JSX sparso).

export interface BetaInviteCodeEligibility {
  active: boolean;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

export type BetaInviteCodeState = "redeemable" | "inactive" | "expired" | "exhausted";

export function computeBetaInviteCodeState(
  code: BetaInviteCodeEligibility,
  now: Date = new Date()
): BetaInviteCodeState {
  if (!code.active) return "inactive";
  if (code.expiresAt) {
    const parsed = Date.parse(code.expiresAt);
    // Fail-safe: una data non valida è trattata come scaduta, mai come
    // "senza scadenza" — stessa scelta di evaluate.ts::isExpired.
    if (Number.isNaN(parsed) || parsed <= now.getTime()) return "expired";
  }
  if (code.maxRedemptions !== null && code.redeemedCount >= code.maxRedemptions) return "exhausted";
  return "redeemable";
}

export function isBetaInviteCodeRedeemable(code: BetaInviteCodeEligibility, now: Date = new Date()): boolean {
  return computeBetaInviteCodeState(code, now) === "redeemable";
}
