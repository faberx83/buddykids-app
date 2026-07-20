import { test, expect } from "@playwright/test";
import {
  ONBOARDING_CHECKLIST_REGISTRY,
  isKnownChecklistItem,
  isRequiredChecklistComplete,
} from "../../lib/onboarding/checklist-registry";
import { WALKTHROUGH_REGISTRY, isKnownTutorial, getTutorialDefinition } from "../../lib/walkthrough/registry";

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
