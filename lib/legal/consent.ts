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

// PRE-MICRO-PILOT CLOSURE GATE (task #573, 25/08/2026) — spostati qui da
// lib/legal/gate.ts: sono logica PURA (nessun I/O), ma gate.ts importa
// "server-only" (obbligatorio per le sue funzioni che leggono/scrivono
// Supabase) — un pacchetto che lancia un'eccezione se richiesto fuori da un
// bundle Next.js server, quindi bloccava anche i test Playwright puri che
// avrebbero dovuto importare SOLO deriveDocumentStatus. Spostandoli qui
// (file senza "server-only", già usato da tests/one/consent.spec.ts) i test
// possono importarli direttamente; gate.ts li ri-esporta per compatibilità
// con chi li importa ancora da lì.
export type LegalDocumentType = "terms" | "privacy_notice";
export type DerivedLegalDocumentStatus = "draft" | "published" | "superseded";

export interface LegalDocumentRecord {
  id: string;
  documentType: LegalDocumentType;
  version: string;
  sha256: string | null;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * Deriva DRAFT/PUBLISHED/SUPERSEDED contro l'intero elenco di righe dello
 * stesso document_type. Lo schema live NON ha una colonna status esplicita
 * (verificato nel POST-CHECK migration_27): PUBLISHED = la riga con
 * published_at valorizzato più recente per quel tipo; SUPERSEDED = una riga
 * con published_at valorizzato ma non la più recente; DRAFT = published_at
 * NULL. "superseded" non è un valore letterale nel DB — è una
 * classificazione puramente applicativa, ricalcolata ogni volta.
 */
export function deriveDocumentStatus(
  doc: LegalDocumentRecord,
  allOfSameType: LegalDocumentRecord[]
): DerivedLegalDocumentStatus {
  if (!doc.publishedAt) return "draft";

  let mostRecent: LegalDocumentRecord | null = null;
  for (const candidate of allOfSameType) {
    if (!candidate.publishedAt) continue;
    if (!mostRecent || Date.parse(candidate.publishedAt) > Date.parse(mostRecent.publishedAt!)) {
      mostRecent = candidate;
    }
  }
  return mostRecent?.id === doc.id ? "published" : "superseded";
}

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

// TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
// 25/08/2026 sera). Prima di questo task, app/actions/legal.ts#
// recordSignupLegalAcceptanceAction era fail-SOFT di proposito (un fallimento
// dell'INSERT su legal_acceptances subito dopo supabase.auth.signUp() non
// bloccava/disfaceva l'account già creato — solo un log). Fabrizio ha chiesto
// di rendere questo fail-CLOSED: un utente non deve ottenere accesso normale
// al prodotto senza un'acceptance persistita per la versione corrente dei
// Termini, anche se auth.users esiste già.
//
// Questa funzione è la decisione PURA, isolata per essere testabile senza
// I/O (LEGAL-17 in tests/one/legal-gate.spec.ts): dato che il gate è attivo
// per l'utente E che non esiste ancora un'acceptance per la versione
// corrente, l'accesso deve restare bloccato (il chiamante — vedi
// app/auth/callback/route.ts — deve ritentare la scrittura con un client
// autenticato reale, disponibile solo a questo punto del flusso, e se il
// retry fallisce ancora, NON deve lasciar proseguire l'utente verso "/" o
// qualunque altra pagina applicativa).
//
// Con legalGateEnabled=false (ogni utente reale oggi, gate globale OFF)
// questa funzione ritorna sempre false: nessun comportamento cambia per
// nessun utente reale finché Fabrizio non attiva il gate.
export function requiresLegalAcceptanceBeforeAccess(
  legalGateEnabled: boolean,
  alreadyAcceptedCurrentTerms: boolean
): boolean {
  return legalGateEnabled && !alreadyAcceptedCurrentTerms;
}

// TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #581, 25/08/2026
// sera). Decisione PURA estratta da app/actions/legal.ts#
// recordSignupLegalAcceptanceAction: un consenso marketing "accepted" viene
// scritto in consent_events SOLO se il checkbox era esplicitamente spuntato
// al momento del signup — mai un default positivo, mai un'invenzione. Non
// esiste un percorso che generi una scrittura "withdrawn" al signup: non
// c'è nulla da ritirare per un consenso mai concesso, il chiamante
// semplicemente non invoca alcuna funzione di scrittura quando questa
// risolve false (vedi recordMarketingConsentEventAtSignupBootstrap in
// lib/legal/gate.ts, mai chiamata in quel caso).
export function shouldRecordMarketingConsentAtSignup(marketingConsentChecked: boolean): boolean {
  return marketingConsentChecked === true;
}
