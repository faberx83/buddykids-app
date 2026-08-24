import { test, expect } from "@playwright/test";
import {
  hasAcceptedCurrentTermsAndPrivacyNotice,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_NOTICE_VERSION,
  CurrentConsentState,
} from "@/lib/legal/consent";

// PRE-LAUNCH REMEDIATION WAVE 1 — R-546 (decisione Fabrizio, 24/08/2026).
// Test puro (nessun I/O), gira in qualunque ambiente — stesso pattern di
// tests/nextgen/planner-week-status.spec.ts. Verifica solo la LOGICA di
// versioning del consenso, non collegata oggi a nessuna scrittura reale
// (vedi commenti in lib/legal/consent.ts).

const baseState: CurrentConsentState = {
  termsVersion: null,
  termsAcceptedAt: null,
  privacyNoticeVersion: null,
  privacyNoticeAcceptedAt: null,
  marketingConsent: false,
  marketingConsentUpdatedAt: null,
};

test.describe("lib/legal/consent — hasAcceptedCurrentTermsAndPrivacyNotice", () => {
  test("TC-N674 - nessun consenso registrato -> false", () => {
    expect(hasAcceptedCurrentTermsAndPrivacyNotice(baseState)).toBe(false);
  });

  test("TC-N675 - entrambi accettati alla versione corrente -> true", () => {
    const state: CurrentConsentState = {
      ...baseState,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-08-24T10:00:00.000Z",
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: "2026-08-24T10:00:00.000Z",
    };
    expect(hasAcceptedCurrentTermsAndPrivacyNotice(state)).toBe(true);
  });

  test("TC-N676 - Termini accettati a una versione VECCHIA -> false (richiede nuovo consenso)", () => {
    const state: CurrentConsentState = {
      ...baseState,
      termsVersion: "v0-draft-2026-01-01",
      termsAcceptedAt: "2026-01-01T10:00:00.000Z",
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: "2026-08-24T10:00:00.000Z",
    };
    expect(hasAcceptedCurrentTermsAndPrivacyNotice(state)).toBe(false);
  });

  test("TC-N677 - solo uno dei due accettato -> false (entrambi richiesti, non un OR)", () => {
    const state: CurrentConsentState = {
      ...baseState,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-08-24T10:00:00.000Z",
      // privacyNoticeVersion/AcceptedAt restano null
    };
    expect(hasAcceptedCurrentTermsAndPrivacyNotice(state)).toBe(false);
  });

  test("TC-N678 - marketingConsent non influenza mai il gate Termini/Privacy Notice (consenso separato)", () => {
    const state: CurrentConsentState = {
      ...baseState,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-08-24T10:00:00.000Z",
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: "2026-08-24T10:00:00.000Z",
      marketingConsent: false, // esplicitamente rifiutato
    };
    expect(hasAcceptedCurrentTermsAndPrivacyNotice(state)).toBe(true);
  });
});
