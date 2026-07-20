import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ONBOARDING_CHECKLIST_REGISTRY,
  isKnownChecklistItem,
  isRequiredChecklistComplete,
} from "../../lib/onboarding/checklist-registry";
import { WALKTHROUGH_REGISTRY, isKnownTutorial, getTutorialDefinition } from "../../lib/walkthrough/registry";
import {
  ONBOARDING_STATUS_REGISTRY,
  getSubmitCta,
  formatOnboardingTransition,
} from "../../lib/onboarding/status-copy";

// TRAMA ONE Build Sprint 1 — unit test puri per lib/onboarding/checklist-registry.ts
// e lib/walkthrough/registry.ts. Stesso principio di tests/one/feature-flags.spec.ts:
// nessun "page" fixture, nessun browser, eseguibili nel sandbox Claude.
//
// Comando: npx playwright test tests/one/onboarding.spec.ts

test.describe("TRAMA ONE — checklist onboarding [no browser]", () => {
  test("il registry ha almeno un item obbligatorio", () => {
    expect(ONBOARDING_CHECKLIST_REGISTRY.some((i) => i.required)).toBe(true);
  });

  test("isKnownChecklistItem: item noto -> true, sconosciuto -> false", () => {
    expect(isKnownChecklistItem("profile_complete")).toBe(true);
    expect(isKnownChecklistItem("item_inventato")).toBe(false);
  });

  test("isRequiredChecklistComplete: false se manca un item obbligatorio", () => {
    const result = isRequiredChecklistComplete([{ itemKey: "profile_complete", completed: true }]);
    // "identity_verified" è required e manca dalla lista -> false
    expect(result).toBe(false);
  });

  test("isRequiredChecklistComplete: true quando tutti gli item required sono completed", () => {
    const requiredKeys = ONBOARDING_CHECKLIST_REGISTRY.filter((i) => i.required).map((i) => i.key);
    const completions = requiredKeys.map((itemKey) => ({ itemKey, completed: true }));
    expect(isRequiredChecklistComplete(completions)).toBe(true);
  });

  test("isRequiredChecklistComplete: item non-required assente non influisce sul risultato", () => {
    const requiredKeys = ONBOARDING_CHECKLIST_REGISTRY.filter((i) => i.required).map((i) => i.key);
    const completions = requiredKeys.map((itemKey) => ({ itemKey, completed: true }));
    // "first_activity_draft" (non required) è assente dalla lista -> non deve bloccare
    expect(isRequiredChecklistComplete(completions)).toBe(true);
  });

  test("isRequiredChecklistComplete: item required presente ma completed=false -> false", () => {
    const requiredKeys = ONBOARDING_CHECKLIST_REGISTRY.filter((i) => i.required).map((i) => i.key);
    const completions = requiredKeys.map((itemKey, idx) => ({ itemKey, completed: idx !== 0 }));
    expect(isRequiredChecklistComplete(completions)).toBe(false);
  });
});

test.describe("TRAMA ONE — motore Walkthrough registry [no browser]", () => {
  test("welcome_parent è un tutorial noto con almeno uno step", () => {
    expect(isKnownTutorial("welcome_parent")).toBe(true);
    expect(WALKTHROUGH_REGISTRY.welcome_parent.steps.length).toBeGreaterThan(0);
  });

  test("tutorial_key sconosciuto -> isKnownTutorial false, getTutorialDefinition undefined", () => {
    expect(isKnownTutorial("tutorial_inventato")).toBe(false);
    expect(getTutorialDefinition("tutorial_inventato")).toBeUndefined();
  });

  test("ogni step del registry ha key/title/description non vuoti (generico, riusabile per futuri tutorial_key)", () => {
    for (const tutorial of Object.values(WALKTHROUGH_REGISTRY)) {
      for (const step of tutorial.steps) {
        expect(step.key.length).toBeGreaterThan(0);
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });

  test("nessuna chiave di step duplicata all'interno dello stesso tutorial", () => {
    for (const tutorial of Object.values(WALKTHROUGH_REGISTRY)) {
      const keys = tutorial.steps.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// TRAMA ONE Sprint 1 Audit Remediation — registry etichette italiane
// (lib/onboarding/status-copy.ts). Test puri, nessun browser: eseguibili nel
// sandbox Claude. Coprono i requisiti #13-19 della sezione 10 della
// remediation: valori tecnici invariati, etichette italiane centralizzate,
// nessuna traduzione duplicata nei componenti, termine "Reclama" assente.
// ────────────────────────────────────────────────────────────────
test.describe("TRAMA ONE — registry etichette italiane onboarding [no browser]", () => {
  const TECHNICAL_STATUSES = ["LEAD", "CLAIMED", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "SUSPENDED"] as const;
  const BANNED_WORDS = ["reclama", "rivendica", "prendi possesso", "diventa proprietario"];

  test("TC-N410a — i valori tecnici persistiti restano esattamente i 6 concordati (nessuna rinomina)", () => {
    expect(Object.keys(ONBOARDING_STATUS_REGISTRY).sort()).toEqual([...TECHNICAL_STATUSES].sort());
  });

  test("TC-N410b — ogni stato ha etichette Partner e Admin non vuote", () => {
    for (const status of TECHNICAL_STATUSES) {
      const entry = ONBOARDING_STATUS_REGISTRY[status];
      expect(entry.partner.label.length).toBeGreaterThan(0);
      expect(entry.admin.label.length).toBeGreaterThan(0);
      expect(entry.partner.description.length).toBeGreaterThan(0);
      expect(entry.admin.description.length).toBeGreaterThan(0);
    }
  });

  test("TC-N410c — Partner e Admin possono avere etichette differenti per lo stesso stato tecnico", () => {
    // LEAD: Partner "Centro da attivare" vs Admin "Da attivare" — intenzionalmente diverse.
    expect(ONBOARDING_STATUS_REGISTRY.LEAD.partner.label).not.toBe(ONBOARDING_STATUS_REGISTRY.LEAD.admin.label);
  });

  test("TC-N410d — la CTA principale per lo stato LEAD (Partner) è 'Avvia l'attivazione del centro'", () => {
    expect(ONBOARDING_STATUS_REGISTRY.LEAD.partner.primaryAction).toBe("Avvia l'attivazione del centro");
  });

  test("TC-N410e — l'azione Admin per lo stato APPROVED è 'Sospendi'", () => {
    expect(ONBOARDING_STATUS_REGISTRY.APPROVED.admin.primaryAction).toBe("Sospendi");
  });

  test("TC-N410f — getSubmitCta distingue CLAIMED (prima sottomissione) da CHANGES_REQUESTED (rinvio)", () => {
    expect(getSubmitCta("CLAIMED")).toBe("Invia per verifica");
    expect(getSubmitCta("CHANGES_REQUESTED")).toBe("Invia nuovamente per verifica");
  });

  test("TC-N410g — formatOnboardingTransition traduce i codici tecnici in etichette italiane leggibili", () => {
    expect(formatOnboardingTransition(null, "LEAD", "partner")).toBe("Centro da attivare");
    expect(formatOnboardingTransition("LEAD", "CLAIMED", "partner")).toBe(
      "Centro da attivare → Attivazione avviata"
    );
    expect(formatOnboardingTransition("SUBMITTED", "APPROVED", "admin")).toBe("Da verificare → Approvato");
    // I codici tecnici grezzi (LEAD, CLAIMED, ...) non devono mai comparire nell'output.
    for (const status of TECHNICAL_STATUSES) {
      expect(formatOnboardingTransition(null, status, "partner")).not.toBe(status);
    }
  });

  test("TC-N410h — nessuna etichetta o descrizione (Partner/Admin) contiene 'Reclama'/'Rivendica'/varianti vietate", () => {
    for (const status of TECHNICAL_STATUSES) {
      const entry = ONBOARDING_STATUS_REGISTRY[status];
      for (const audience of ["partner", "admin"] as const) {
        const copy = entry[audience];
        const haystack = [copy.label, copy.description, copy.primaryAction, copy.waitingState]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        for (const banned of BANNED_WORDS) {
          expect(haystack).not.toContain(banned);
        }
      }
    }
  });

  test("TC-N410i — i componenti Partner/Admin onboarding importano il registry centralizzato e non definiscono etichette proprie duplicate", () => {
    // Source-scan statico: verifica che nessuno dei due componenti UI
    // dichiari un proprio STATUS_LABEL locale (regressione già corretta in
    // questa remediation) e che nessuno dei due contenga la parola "Reclama"
    // o varianti vietate in nessuna forma (maiuscole incluse).
    const files = [
      "app/center/one/onboarding/OnboardingClient.tsx",
      "app/admin/one/onboarding/AdminOnboardingReviewClient.tsx",
    ];
    for (const relativePath of files) {
      const source = readFileSync(join(__dirname, "../../", relativePath), "utf-8").toLowerCase();
      expect(source).not.toContain("const status_label");
      for (const banned of BANNED_WORDS) {
        expect(source).not.toContain(banned);
      }
      expect(source).toContain("status-copy");
    }
  });
});
