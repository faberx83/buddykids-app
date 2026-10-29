// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Apertura del pannello feedback
// da punti diversi dal pulsante flottante (Profilo, pagina Novità), senza
// duplicare il pannello: un evento window ascoltato dall'unica istanza di
// BetaFeedbackButton montata in app/nextgen/layout.tsx.

export const OPEN_BETA_FEEDBACK_EVENT = "trama:open-beta-feedback";

// 15/10/2026: "home" = riga "Dicci cosa ne pensi" in fondo alla Home V2.
// 29/10/2026: "centro" e "oggi" dal portale centri V2 (components/center/PartnerFeedbackCard.tsx).
export type FeedbackOpenSource = "floating" | "profilo" | "novita" | "home" | "centro" | "oggi";

export function openBetaFeedback(source: FeedbackOpenSource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_BETA_FEEDBACK_EVENT, { detail: { source } }));
}
