// TRAMA — CONSENSI AL PRIMO ACCESSO (20/11/2026).
// Fabrizio: "manca qualche flag di accettazione consenso e informativa privacy
// alla prima login sia parent che partner... si può aggiungere e salvare a db?"
// Decisione (20/11): per ora SOLO famiglie; i centri aspettano testi dedicati.
//
// Logica pura (nessun I/O): quando mostrare la schermata "Prima di continuare"
// e quando il genitore può confermarla. Le letture stanno in lib/legal/gate.ts,
// il salvataggio in app/actions/legal.ts.

/** Valore di legal_acceptances.source e consent_events.source per questo flusso. */
export const FIRST_ACCESS_SOURCE = "first_access";

/** Ruoli che vedono la schermata (decisione del 20/11/2026: solo famiglie). */
export const FIRST_ACCESS_ROLES: readonly string[] = ["parent"];

export interface FirstAccessDocStatus {
  /** Esiste una versione pubblicata il cui testo nel codice coincide con l'impronta registrata. */
  available: boolean;
  /** L'utente ha già accettato (o preso visione di) QUELLA versione. */
  accepted: boolean;
}

export interface FirstAccessGateInput {
  gateEnabled: boolean;
  role: string | null;
  terms: FirstAccessDocStatus;
  privacy: FirstAccessDocStatus;
}

/**
 * true se la schermata va mostrata. Mai un blocco senza un testo da accettare:
 * se uno dei due documenti non è disponibile (non pubblicato o impronta
 * diversa), la schermata NON compare — meglio lasciar entrare che chiudere
 * fuori le famiglie per un problema di pubblicazione.
 */
export function needsFirstAccessConsent(input: FirstAccessGateInput): boolean {
  if (!input.gateEnabled) return false;
  if (!input.role || !FIRST_ACCESS_ROLES.includes(input.role)) return false;
  if (!input.terms.available || !input.privacy.available) return false;
  return !input.terms.accepted || !input.privacy.accepted;
}

export interface FirstAccessChoices {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

/** Termini e presa visione dell'Informativa sono obbligatori; il marketing no. */
export function canSubmitFirstAccessConsent(choices: Pick<FirstAccessChoices, "terms" | "privacy">): boolean {
  return choices.terms === true && choices.privacy === true;
}

/**
 * Si registra un consenso marketing solo se spuntato E se l'utente non ha mai
 * espresso una scelta (in registrazione o dal profilo): la schermata non deve
 * mai ritirare o duplicare una scelta già fatta.
 */
export function shouldRecordMarketingAtFirstAccess(marketingChecked: boolean, hasPriorMarketingDecision: boolean): boolean {
  return marketingChecked && !hasPriorMarketingDecision;
}
