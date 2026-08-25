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

// REVISIONE v2 (PRE-MICRO-PILOT CLOSURE GATE, 25/08/2026, task #559): il
// modello DB non usa più un'unica tabella "consent_events" per tutte e 3 le
// aree — vedi supabase/migration_27_privacy_terms_consent.sql v2. Termini e
// Privacy Notice vivono in `legal_acceptances` (SOLO azione "accettato",
// niente withdraw/decline: non sono un consenso revocabile). SOLO il
// marketing resta un vero `consent_events` (accepted/withdrawn). I due tipi
// sotto restano un'unione per comodità di questo file (nessuna scrittura
// reale oggi, vedi header sopra), ma un futuro wiring non deve MAI scrivere
// 'declined'/'withdrawn' per 'terms'/'privacy_notice' — solo 'accepted'.
export type ConsentType = "terms" | "privacy_notice" | "marketing";
export type ConsentAction = "accepted" | "declined" | "withdrawn";

// SEGNAPOSTO SOLO PER I TEST PURI DI QUESTO FILE (tests/one/consent.spec.ts)
// — NON usate dal wiring reale. Da task #567 (25/08/2026, PRE-MICRO-PILOT
// CLOSURE GATE) la versione "corrente" reale non è più una costante nel
// codice: è sempre la riga PUBLISHED più recente in legal_documents,
// risolta dinamicamente da lib/legal/gate.ts#resolvePublishedDocument (mai
// una stringa fornita dal client, mai un valore fisso qui). Queste due
// costanti restano solo per continuare a testare hasAcceptedCurrentTermsAndPrivacyNotice
// in isolamento, senza I/O.
export const CURRENT_TERMS_VERSION = "v0-draft-2026-08-24";
export const CURRENT_PRIVACY_NOTICE_VERSION = "v0-draft-2026-08-24";

// SEGNAPOSTO (task #570, 25/08/2026) — parental_declarations.declaration_version
// non è collegata a legal_documents da una foreign key (è testo libero,
// verificato nello schema live): non esiste un "PUBLISHED" da risolvere
// dinamicamente come per Termini/Privacy Notice. Finché il testo reale della
// dichiarazione di responsabilità genitoriale non è scritto/validato, questo
// resta l'unico valore usato da app/actions/kids.ts — attivo SOLO quando
// LEGAL_TERMS_GATE risolve true per l'utente (mai per un utente reale oggi).
export const CURRENT_PARENTAL_DECLARATION_VERSION = "v0-draft-2026-08-24";

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
