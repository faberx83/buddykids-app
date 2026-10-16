// TRAMA — TESTI LEGALI VERSIONATI (16/10/2026, pacchetto 2 go-live).
// Il testo vive nel codice (questo registro), il database registra solo QUALE
// versione è pubblicata: legal_documents (document_type, version, sha256,
// published_at). Le pagine /privacy e /terms mostrano il testo SOLO se la
// riga pubblicata ha una versione presente qui E l'impronta sha256 coincide:
// così nessuno può mostrare un testo diverso da quello registrato. Nessuna
// migrazione: la colonna sha256 esiste già (migration_27).
//
// Regola: un testo pubblicato non si modifica mai. Per cambiarlo si aggiunge
// una nuova versione qui e la si pubblica con una nuova riga.

import { PRIVACY_2026_10_16_BOZZA1 } from "@/lib/legal/texts/privacy-2026-10-16-bozza1";
import { TERMS_2026_10_16_BOZZA1 } from "@/lib/legal/texts/terms-2026-10-16-bozza1";
import type { LegalDocumentType } from "@/lib/legal/consent";

export const LEGAL_TEXTS: Record<LegalDocumentType, Record<string, string>> = {
  privacy_notice: { "2026-10-16-bozza1": PRIVACY_2026_10_16_BOZZA1 },
  terms: { "2026-10-16-bozza1": TERMS_2026_10_16_BOZZA1 },
};

/** Ultima versione preparata per tipo (quella da pubblicare con legal_publish_*.sql). */
export const LATEST_LEGAL_VERSION: Record<LegalDocumentType, string> = {
  privacy_notice: "2026-10-16-bozza1",
  terms: "2026-10-16-bozza1",
};

export function legalTextFor(type: LegalDocumentType, version: string): string | null {
  return LEGAL_TEXTS[type]?.[version] ?? null;
}

/** Una bozza (in attesa di revisione legale) si riconosce dal nome della versione. */
export function isDraftLegalVersion(version: string): boolean {
  return /bozza/i.test(version);
}
