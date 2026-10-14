// TRAMA — ONBOARDING V2 (14/10/2026, piano unito approvato da Fabrizio).
// Tre schermate "perché" + figli + scuola + Home, dietro ONBOARDING_V2_ENABLED
// (release "onboarding-v2"), chiave tutorial nuova; invito all'installazione
// dopo la prima azione utile; "Rivedi l'introduzione" nel Profilo. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  ONBOARDING_V2_SLIDES,
  ONBOARDING_V2_TUTORIAL_KEY,
  ONBOARDING_V2_STEP_KEY,
  ONBOARDING_V2_INTERESTS,
  onboardingV2SetupPhases,
  shouldAskSchool,
  ageFromIso,
} from "../../lib/nextgen/onboarding-v2";
import { PARENT_ONBOARDING_TUTORIAL_KEY } from "../../lib/nextgen/onboarding-slides";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";
import { categories } from "../../lib/mock-data";
import { profileV2Sections } from "../../lib/nextgen/profile-v2";
import { FIRST_ACTION_EVENT, FIRST_ACTION_STORAGE_KEY } from "../../lib/nextgen/first-action";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Onboarding V2 [no browser]", () => {
  test("OV2-01 tre schermate 'perché' con i testi approvati, l'ultima porta a 'Inizia a organizzare'", () => {
    expect(ONBOARDING_V2_SLIDES.map((s) => s.title)).toEqual([
      "Tutto quello che fanno i tuoi figli, in un posto.",
      "Anche se il centro non è su TRAMA.",
      "Non solo cosa. Anche chi.",
    ]);
    expect(ONBOARDING_V2_SLIDES.map((s) => s.ctaLabel)).toEqual(["Continua", "Continua", "Inizia a organizzare"]);
    for (const s of ONBOARDING_V2_SLIDES) {
      expect(s.pops).toHaveLength(2);
      expect(s.title).toContain(s.highlight);
    }
    // il telefono ruota da una schermata all'altra
    expect(new Set(ONBOARDING_V2_SLIDES.map((s) => `${s.tilt.y}/${s.tilt.x}`)).size).toBe(3);
  });

  test("OV2-02 chiave tutorial NUOVA (si vede una volta anche da chi ha visto l'attuale), registrata con lo step sentinella", () => {
    expect(ONBOARDING_V2_TUTORIAL_KEY).toBe("family_onboarding_v2");
    expect(ONBOARDING_V2_TUTORIAL_KEY).not.toBe(PARENT_ONBOARDING_TUTORIAL_KEY);
    const def = WALKTHROUGH_REGISTRY[ONBOARDING_V2_TUTORIAL_KEY];
    expect(def).toBeTruthy();
    expect(def.steps.map((s) => s.key)).toEqual([ONBOARDING_V2_STEP_KEY]);
  });

  test("OV2-03 flag spento di default, voce di catalogo release-eligible in una release propria", () => {
    const flag = FEATURE_FLAG_REGISTRY.ONBOARDING_V2_ENABLED;
    expect(flag.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((f) => f.key === "onboarding_v2");
    expect(entry?.flagName).toBe("ONBOARDING_V2_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(entry?.area).toBe("parent");
    const release = RELEASE_CATALOG.find((r) => r.id === "onboarding-v2");
    expect(release?.featureKeys).toEqual(["onboarding_v2"]);
    for (const f of entry?.sourceFiles ?? []) expect(fs.existsSync(path.join(__dirname, "../..", f)), f).toBe(true);
  });

  test("OV2-04 passi: figli sempre; scuola solo con calendario attivo, figli presenti e scuola mancante", () => {
    expect(onboardingV2SetupPhases({ kidsCount: 0, schoolCalendarEnabled: true, kidsWithoutSchoolCount: 0 })).toEqual(["figli"]);
    expect(onboardingV2SetupPhases({ kidsCount: 2, schoolCalendarEnabled: true, kidsWithoutSchoolCount: 1 })).toEqual(["figli", "scuola"]);
    expect(onboardingV2SetupPhases({ kidsCount: 2, schoolCalendarEnabled: false, kidsWithoutSchoolCount: 2 })).toEqual(["figli"]);
    expect(onboardingV2SetupPhases({ kidsCount: 2, schoolCalendarEnabled: true, kidsWithoutSchoolCount: 0 })).toEqual(["figli"]);
    expect(shouldAskSchool({ schoolCalendarEnabled: true, kidsCount: 1, kidsWithoutSchoolCount: 1 })).toBe(true);
  });

  test("OV2-05 età dalla data di nascita (compleanno non ancora passato = un anno in meno)", () => {
    const today = new Date(2026, 9, 14); // 14 ottobre 2026
    expect(ageFromIso("2019-03-12", today)).toBe(7);
    expect(ageFromIso("2019-10-15", today)).toBe(6);
    expect(ageFromIso("2019-10-14", today)).toBe(7);
    expect(ageFromIso("non-una-data", today)).toBeNull();
  });

  test("OV2-06 interessi salvati nello stesso formato di AddKidForm (emoji + etichetta), a schermo solo l'etichetta", () => {
    const known = new Set(categories.map((c) => `${c.emoji} ${c.label}`));
    for (const opt of ONBOARDING_V2_INTERESTS) {
      expect(known.has(opt.value), opt.value).toBe(true);
      expect(opt.value.endsWith(opt.label)).toBe(true);
    }
  });

  test("OV2-07 componente: riusa le Server Action esistenti, CTA navy a raggio 12, niente pillole viola", () => {
    const src = read("components/nextgen/OnboardingV2.tsx");
    for (const action of [
      "startWalkthroughStepAction",
      "completeWalkthroughStepAction",
      "addKidAction",
      "isParentalDeclarationGateEnabledAction",
      "setSchoolContextForFamilyAction",
    ]) {
      expect(src, action).toContain(action);
    }
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("Lo faccio dopo");
    expect(src).toContain("rounded-[12px] bg-trama-primary");
    expect(src).not.toContain("bg-trama-violet");
    expect(src).not.toMatch(/rounded-full bg-trama-primary/);
    // stile dinamico della versione precedente (scelta di Fabrizio, 14/10):
    // telefono che fluttua e ruota a ogni schermata, card che escono dal
    // telefono, testo con blur — sempre solo in motion-safe
    expect(src).toContain("motion-safe:animate-[trama-onb-float_2.8s_ease-in-out_infinite]");
    expect(src).toContain("rotateY(${slide.tilt.y}deg) rotateX(${slide.tilt.x}deg)");
    expect(src).toContain("motion-safe:animate-[trama-onb-pop-left");
    expect(src).toContain("motion-safe:animate-[trama-onb-screen");
    expect(src).toContain("motion-reduce:!transform-none");
    expect(read("app/globals.css")).toContain("@keyframes trama-onb2-in");
  });

  test("OV2-08 layout: con il flag l'onboarding V2 prende il posto del carousel; senza, resta quello attuale", () => {
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain('flagName: "ONBOARDING_V2_ENABLED"');
    expect(layout).toContain("{onboardingV2Enabled ? (");
    expect(layout).toContain("<OnboardingCarousel progress={onboardingProgress} />");
    expect(layout).toContain("getWalkthroughProgress(user.id, ONBOARDING_V2_TUTORIAL_KEY)");
    // dati di figli e scuola solo se l'onboarding sta per comparire
    expect(layout).toContain("if (onboardingV2Progress?.currentStepKey) {");
    // lo Spotlight aspetta la fine dell'onboarding, qualunque versione
    expect(layout).toContain("const welcome = onboardingV2Enabled ? onboardingV2Progress : onboardingProgress;");
  });

  test("OV2-09 invito 'Aggiungi alla schermata Home' dopo la prima azione utile (solo con il flag)", () => {
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain("waitForFirstAction={onboardingV2Enabled}");
    const prompt = read("components/InstallPrompt.tsx");
    expect(prompt).toContain("waitForFirstAction = false,");
    expect(prompt).toContain("if (!firstActionDone) return null;");
    expect(FIRST_ACTION_STORAGE_KEY).toBe("trama_first_useful_action");
    expect(FIRST_ACTION_EVENT).toBe("trama:first-useful-action");
    const marks: [string, string][] = [
      ["components/nextgen/ExternalPlannerItemsSection.tsx", 'markFirstUsefulAction("impegno")'],
      ["components/nextgen/DiscoverResultCard.tsx", 'markFirstUsefulAction("salvata")'],
      ["components/nextgen/DiscoveryLeadCard.tsx", 'markFirstUsefulAction("nel_planner")'],
      ["app/nextgen/scoperta/[id]/CommunityDiscoveryDetailClient.tsx", 'markFirstUsefulAction("nel_planner")'],
      ["app/nextgen/planner/PlannerV2Client.tsx", 'markFirstUsefulAction("chi_porta")'],
      ["app/booking/[id]/BookingClient.tsx", 'markFirstUsefulAction("prenotazione")'],
    ];
    for (const [file, call] of marks) expect(read(file), file).toContain(call);
  });

  test("OV2-10 Profilo: 'Rivedi l'introduzione' solo con il flag; Preferenze riavvia la versione giusta", () => {
    const base = { unreadReplies: 0, classicFallbackEnabled: false, onFeedback: () => {}, onClassic: () => {} };
    const without = profileV2Sections(base).flatMap((s) => s.items.map((i) => i.key));
    expect(without).not.toContain("introduzione");
    const withIntro = profileV2Sections({ ...base, onReplayIntro: () => {} }).flatMap((s) => s.items.map((i) => i.key));
    expect(withIntro).toContain("introduzione");
    expect(read("app/nextgen/profile/ProfileV2Client.tsx")).toContain("restartWalkthroughAction(ONBOARDING_V2_TUTORIAL_KEY)");
    expect(read("app/nextgen/profile/impostazioni/preferenze/page.tsx")).toContain(
      "getTutorialDefinition(onboardingV2Enabled ? ONBOARDING_V2_TUTORIAL_KEY : PARENT_ONBOARDING_TUTORIAL_KEY)"
    );
  });
  test("OV2-11 'Rivedi l'introduzione' funziona: niente delete (manca la policy RLS), passi rimessi a not_started; il componente riparte da capo", () => {
    const actions = read("app/actions/walkthrough.ts");
    const restart = actions.slice(actions.indexOf("export async function restartWalkthroughAction"));
    expect(restart).not.toContain(".delete()");
    expect(restart).toContain('upsertStep(supabase, user.id, tutorialKey, step.key, "not_started")');
    for (const f of ["components/nextgen/OnboardingV2.tsx", "components/nextgen/OnboardingCarousel.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("if (visible !== wasVisible) {");
      expect(src, f).toContain("setDismissed(false);");
    }
  });

  test("OV2-12 Profilo raggiungibile da Planner, Scopri e Prenotazioni (solo con la nuova barra)", () => {
    const chip = read("components/nextgen/ProfileChip.tsx");
    expect(chip).toContain('href="/nextgen/profile"');
    expect(chip).toContain("if (!enabled) return null;");
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain("<ProfileChipProvider value={{ enabled: navV2Enabled, firstName: profileFirstName, avatarUrl: profileAvatarUrl }}>");
    for (const f of [
      "app/nextgen/planner/PlannerV2Client.tsx",
      "app/nextgen/search/SearchDiscoveryClient.tsx",
      "app/nextgen/prenotazioni/PrenotazioniV2Client.tsx",
    ]) {
      expect(read(f), f).toContain("<ProfileChip />");
    }
  });
});
