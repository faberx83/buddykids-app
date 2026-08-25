"use server";

// PRE-MICRO-PILOT CLOSURE GATE — task #568 (25/08/2026). Wiring del Legal
// Gate al signup (LoginForm.tsx), dietro il flag LEGAL_TERMS_GATE (OFF di
// default — vedi lib/feature-flags/registry.ts). Nessuna di queste azioni
// viene mai chiamata se il flag risolve false, che è il caso di OGNI
// utente reale finché Fabrizio non attiva esplicitamente un override.

import {
  acceptCurrentLegalDocumentAtSignupBootstrap,
  recordMarketingConsentEventAtSignupBootstrap,
  acceptCurrentLegalDocument,
  hasAcceptedCurrentDocument,
} from "@/lib/legal/gate";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { shouldRecordMarketingConsentAtSignup } from "@/lib/legal/consent";

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

  if (shouldRecordMarketingConsentAtSignup(marketingConsent)) {
    const marketingResult = await recordMarketingConsentEventAtSignupBootstrap(userId, "accepted", "signup");
    if (marketingResult.error) return { error: marketingResult.error };
  }

  return {};
}

/**
 * Chiamata da AddKidForm.tsx (client component, non ha modo di risolvere il
 * flag direttamente: nessun Client Component deve leggere feature_flag_overrides)
 * per sapere se mostrare il checkbox di dichiarazione genitoriale — task
 * #570. Risolve LEGAL_TERMS_GATE per l'utente CORRENTE (qui esiste già una
 * sessione autenticata, a differenza del bootstrap di signup: nessun
 * service client necessario). Restituisce sempre false se non autenticato
 * o se Supabase non è configurato — stesso fail-safe di resolveFeatureFlag().
 */
export async function isParentalDeclarationGateEnabledAction(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  return resolveFeatureFlag({ flagName: "LEGAL_TERMS_GATE", userId: user.id });
}

/**
 * TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
 * 25/08/2026 sera). Chiamata SOLO da app/auth/callback/route.ts (server,
 * subito dopo exchangeCodeForSession) quando LEGAL_TERMS_GATE risolve true
 * per l'utente E hasAcceptedCurrentDocument("terms") risulta false — cioè
 * il bootstrap fail-soft di recordSignupLegalAcceptanceAction (chiamato da
 * LoginForm.tsx subito dopo signUp(), quando NON esisteva ancora una
 * sessione autenticata) è fallito o non è mai stato eseguito.
 *
 * A differenza del bootstrap, qui esiste GIÀ una sessione autenticata reale
 * (auth.uid() = user.id soddisfa la RLS di legal_acceptances) — nessun
 * service client necessario, nessuna validazione "riga profiles esiste"
 * aggiuntiva richiesta (la RLS stessa la sostituisce).
 *
 * Se questo retry fallisce ANCORA (es. nessun documento PUBLISHED — sempre
 * il caso oggi, gate OFF), il chiamante deve fail-closed: NON lasciar
 * proseguire l'utente verso l'app (vedi requiresLegalAcceptanceBeforeAccess
 * in lib/legal/consent.ts e il redirect verso /auth/legal-pending).
 */
export async function retryPendingTermsAcceptanceAction(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const result = await acceptCurrentLegalDocument(supabase, user.id, "terms", "signup_callback_retry");
  return { ok: result.ok, error: result.error };
}

/**
 * true se l'utente CORRENTE (sessione autenticata) ha già un'acceptance
 * valida per la versione PUBLISHED corrente dei Termini — usata dalla
 * pagina /auth/legal-pending per decidere se può già proseguire (es. dopo
 * un retry riuscito in un altro tab) senza dover ripetere l'azione.
 */
export async function hasCurrentUserAcceptedTermsAction(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  return hasAcceptedCurrentDocument(supabase, user.id, "terms");
}
