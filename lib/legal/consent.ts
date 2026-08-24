// PRE-LAUNCH REMEDIATION WAVE 1 — R-546 (decisione Fabrizio, 24/08/2026).
// Vedi docs/trama-one/analysis/PRIVACY_TERMS_TECHNICAL_DESIGN.md.
//
// Questo file NON è ancora collegato alla registrazione (app/auth/login/
// LoginForm.tsx) né a nessuna scrittura su Supabase: le colonne/tabella che
// userebbe (migration_27_privacy_terms_consent.sql) non sono state
// applicate. È solo l'infrastruttura di versioning — inerte, nessun rischio
// per il flusso di signup esistente finché non viene esplicitamente
// collegata (vedi il documento di design per il piano del collegamento).
//
// "technical controls implemented / legal text pending validation" — questo
// file implementa SOLO il meccanismo di versioning tecnico. Le stringhe di
// versione sotto sono segnaposto ("v0-draft-...") e i testi legali reali
// (Informativa Privacy, Termini di Servizio) NON sono stati scritti da
// Claude: richiedono revisione legale prima di essere pubblicati a utenti
// reali (vedi C-01/C-02 in TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md). Nessuna
// riga di questo file, né altrove nel prodotto, deve mai concludere
// "conforme al GDPR" — solo "controlli tecnici predisposti, testo legale
// in attesa di validazione".

export type ConsentType = "terms" | "privacy_notice" | "marketing";
export type ConsentAction = "accepted" | "declined" | "withdrawn";

// SEGNAPOSTO — da sostituire con la versione reale quando il testo legale
// definitivo sarà pronto e validato. Il formato "vN-YYYY-MM-DD" permette di
// distinguere "utente ha accettato una versione precedente, va richiesto un
// nuovo consenso" da "utente in regola con la versione corrente" con un
// semplice confronto stringa — nessuna logica di parsing/semver necessaria
// per il volume atteso (poche versioni per anno).
export const CURRENT_TERMS_VERSION = "v0-draft-2026-08-24";
export const CURRENT_PRIVACY_NOTICE_VERSION = "v0-draft-2026-08-24";

export interface CurrentConsentState {
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  privacyNoticeVersion: string | null;
  privacyNoticeAcceptedAt: string | null;
  marketingConsent: boolean;
  marketingConsentUpdatedAt: string | null;
}

/**
 * true se l'utente ha accettato la versione CORRENTE di Termini e Privacy
 * Notice (non una versione precedente) — il gate che una futura pagina di
 * "compliance check" o un middleware potrebbe usare prima di lasciar
 * prenotare/pubblicare un'attività. Pura, nessun I/O: chi la chiama legge
 * prima lo stato da profiles/consent_events.
 */
export function hasAcceptedCurrentTermsAndPrivacyNotice(state: CurrentConsentState): boolean {
  return (
    state.termsVersion === CURRENT_TERMS_VERSION &&
    state.termsAcceptedAt !== null &&
    state.privacyNoticeVersion === CURRENT_PRIVACY_NOTICE_VERSION &&
    state.privacyNoticeAcceptedAt !== null
  );
}
