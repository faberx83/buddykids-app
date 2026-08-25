"use server";

// PRE-MICRO-PILOT CLOSURE GATE — task #568 (25/08/2026). Wiring del Legal
// Gate al signup (LoginForm.tsx), dietro il flag LEGAL_TERMS_GATE (OFF di
// default — vedi lib/feature-flags/registry.ts). Nessuna di queste azioni
// viene mai chiamata se il flag risolve false, che è il caso di OGNI
// utente reale finché Fabrizio non attiva esplicitamente un override.

import {
  acceptCurrentLegalDocumentAtSignupBootstrap,
  recordMarketingConsentEventAtSignupBootstrap,
} from "@/lib/legal/gate";

/**
 * Chiamata dal client SUBITO dopo un supabase.auth.signUp() riuscito, con lo
 * userId restituito direttamente da Supabase Auth (mai un input utente
 * arbitrario — vedi il commento in acceptCurrentLegalDocumentAtSignupBootstrap
 * sul perché serve un bootstrap con service client: la conferma email è
 * richiesta, quindi non esiste ancora una sessione/RLS-friendly auth.uid()
 * nel momento esatto in cui questa azione gira).
 *
 * Fail-soft di proposito: un fallimento qui NON deve bloccare/disfare la
 * creazione dell'account (già avvenuta lato Supabase Auth prima che questa
 * azione venga chiamata) — ritorna solo un errore informativo per
 * telemetria/log, il chiamante (LoginForm.tsx) non lo mostra come blocco
 * della registrazione.
 */
export async function recordSignupLegalAcceptanceAction(
  userId: string,
  marketingConsent: boolean
): Promise<{ error?: string }> {
  if (!userId) return { error: "userId mancante" };

  const termsResult = await acceptCurrentLegalDocumentAtSignupBootstrap(userId, "terms", "signup");
  if (!termsResult.ok) return { error: termsResult.error || "Errore registrazione accettazione Termini" };

  // Privacy Notice: NESSUNA scrittura qui per costruzione (§8 del messaggio
  // operativo di Fabrizio, 25/08/2026 — "deve NOT registrare
  // 'privacy_accepted', nessun evento separato a meno che il modello non lo
  // preveda già ed sia utile"). La Privacy Notice è un'informativa (Art. 13
  // GDPR), non un consenso: in LoginForm.tsx compare come link informativo
  // accanto al checkbox Termini, non come un secondo checkbox da spuntare —
  // decisione esplicita, non un'omissione.

  if (marketingConsent) {
    const marketingResult = await recordMarketingConsentEventAtSignupBootstrap(userId, "accepted", "signup");
    if (marketingResult.error) return { error: marketingResult.error };
  }

  return {};
}
