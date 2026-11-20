import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  FIRST_ACCESS_ROLES,
  FIRST_ACCESS_SOURCE,
  canSubmitFirstAccessConsent,
  needsFirstAccessConsent,
  shouldRecordMarketingAtFirstAccess,
} from "../../lib/legal/first-access";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

// TRAMA — CONSENSI AL PRIMO ACCESSO (20/11/2026).
// Fabrizio: "manca qualche flag di accettazione consenso e informativa privacy
// alla prima login... si può aggiungere e salvare a db?" — decisione: solo
// famiglie per ora.
// [no browser]: regola pura + controlli sul sorgente. La prova nel browser
// (flag acceso, account senza accettazioni) è "pending local verification".
//
// Comando: npx playwright test tests/one/consensi-primo-accesso.spec.ts

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const OK = { available: true, accepted: true };
const MISSING = { available: true, accepted: false };
const UNPUBLISHED = { available: false, accepted: false };

test.describe("Consensi al primo accesso — regola", () => {
  test("FA-01: flag spento → nessuna schermata, anche senza accettazioni", () => {
    expect(needsFirstAccessConsent({ gateEnabled: false, role: "parent", terms: MISSING, privacy: MISSING })).toBe(false);
  });

  test("FA-02: famiglia senza Termini o senza Informativa → schermata", () => {
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: MISSING, privacy: MISSING })).toBe(true);
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: OK, privacy: MISSING })).toBe(true);
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: MISSING, privacy: OK })).toBe(true);
  });

  test("FA-03: tutto accettato nella versione pubblicata → nessuna schermata", () => {
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: OK, privacy: OK })).toBe(false);
  });

  test("FA-04: solo famiglie (decisione 20/11): centri e Admin non la vedono", () => {
    expect(FIRST_ACCESS_ROLES).toEqual(["parent"]);
    for (const role of ["center_admin", "platform_admin", null]) {
      expect(needsFirstAccessConsent({ gateEnabled: true, role, terms: MISSING, privacy: MISSING })).toBe(false);
    }
  });

  test("FA-05: mai un blocco senza testo da accettare (documento non pubblicato o impronta diversa)", () => {
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: UNPUBLISHED, privacy: MISSING })).toBe(false);
    expect(needsFirstAccessConsent({ gateEnabled: true, role: "parent", terms: MISSING, privacy: UNPUBLISHED })).toBe(false);
  });

  test("FA-06: Termini e Informativa obbligatori, marketing facoltativo e mai sovrascritto", () => {
    expect(canSubmitFirstAccessConsent({ terms: true, privacy: true })).toBe(true);
    expect(canSubmitFirstAccessConsent({ terms: true, privacy: false })).toBe(false);
    expect(canSubmitFirstAccessConsent({ terms: false, privacy: true })).toBe(false);
    expect(shouldRecordMarketingAtFirstAccess(true, false)).toBe(true);
    expect(shouldRecordMarketingAtFirstAccess(false, false)).toBe(false);
    expect(shouldRecordMarketingAtFirstAccess(true, true)).toBe(false);
  });
});

test.describe("Consensi al primo accesso — controlli sul sorgente", () => {
  test('SRC-01: flag spento di default e gestito dalla card Release "Consensi e informative"', () => {
    const flag = FEATURE_FLAG_REGISTRY.LEGAL_FIRST_ACCESS_GATE;
    expect(flag.defaultValue).toBe(false);
    expect(flag.allowedScopes).toContain("cohort");
    const entry = FEATURE_CATALOG.find((f) => f.key === "legal_first_access_consent");
    expect(entry?.flagName).toBe("LEGAL_FIRST_ACCESS_GATE");
    expect(entry?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "consensi-informative")?.featureKeys).toContain("legal_first_access_consent");
  });

  test("SRC-02: salvataggio a db — Termini e Informativa in legal_acceptances, marketing in consent_events", () => {
    const action = read("app/actions/legal.ts");
    expect(action).toContain("export async function acceptFirstAccessConsentAction");
    expect(action).toMatch(/acceptCurrentLegalDocument\(supabase, user\.id, "terms", FIRST_ACCESS_SOURCE\)/);
    expect(action).toMatch(/acceptCurrentLegalDocument\(supabase, user\.id, "privacy_notice", FIRST_ACCESS_SOURCE\)/);
    expect(action).toMatch(/recordMarketingConsentEvent\(supabase, user\.id, "accepted", FIRST_ACCESS_SOURCE\)/);
    // La versione la risolve il server, mai il client.
    expect(action).toContain("getFirstAccessConsentPayload(supabase, user.id, role)");
    expect(FIRST_ACCESS_SOURCE).toBe("first_access");
  });

  test("SRC-03: la schermata compare nell'app famiglie NextGen e Legacy, e non nel portale centri", () => {
    for (const file of ["app/nextgen/layout.tsx", "app/(main)/layout.tsx"]) {
      const src = read(file);
      expect(src).toContain("getFirstAccessConsentPayload(supabase, user.id");
      expect(src).toContain("<FirstAccessConsentScreen");
    }
    expect(read("app/center/layout.tsx")).not.toContain("FirstAccessConsentScreen");
  });

  test("SRC-04: il testo si verifica con l'impronta e la lettura fallisce aperta", () => {
    const gate = read("lib/legal/gate.ts");
    expect(gate).toContain('flagName: "LEGAL_FIRST_ACCESS_GATE"');
    expect(gate).toMatch(/legalTextSha256\(text\) !== doc\.sha256\) return null/);
    expect(gate).toMatch(/catch \{\s*return null;\s*\}\s*\}\s*$/);
  });

  test("SRC-05: la schermata mostra i testi sul posto, caselle obbligatorie e marketing facoltativo", () => {
    const screen = read("components/legal/FirstAccessConsentScreen.tsx");
    expect(screen).toContain("<LegalDocumentView");
    expect(screen).toContain('testId="consent-terms"');
    expect(screen).toContain('testId="consent-privacy"');
    expect(screen).toMatch(/\{showMarketing && \(/);
    expect(screen).toContain("disabled={!canSubmit || busy}");
    expect(screen).toContain("router.refresh()");
  });

  test("SRC-06: in registrazione si registra anche la presa visione dell'Informativa", () => {
    expect(read("app/actions/legal.ts")).toContain('acceptCurrentLegalDocumentAtSignupBootstrap(userId, "privacy_notice", "signup")');
    expect(read("app/auth/login/LoginForm.tsx")).toContain("e dichiaro di aver letto l&apos;");
  });
});
