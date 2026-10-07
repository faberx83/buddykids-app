import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";
import {
  ONBOARDING_SLIDES,
  PARENT_ONBOARDING_TUTORIAL_KEY,
  PARENT_ONBOARDING_STEP_KEY,
} from "../../lib/nextgen/onboarding-slides";

const DIALOG_NAME = "Trova attività giuste per i tuoi figli.";
const LAST_TITLE = "Fate rete con altre famiglie.";

// TRAMA — Parent Private Beta Onboarding Carousel.
//
// FAMILY-FIRST BETA PASS (07/10/2026): nuova versione a 4 schermate (Scopri,
// Organizza, Coordina, Insieme) con chiave di tutorial "family_first_onboarding"
// e visibile anche all'Admin piattaforma nell'app famiglie. Test aggiornati:
// stessi controlli (comparsa, Salta, completa, persistenza, ruoli, tastiera,
// replay), testi e conteggi della nuova versione.
//
// FINAL PRE-FREEZE WAVE (08/09/2026) — copy sostituita integralmente (vedi
// lib/nextgen/onboarding-slides.ts), test aggiornati di conseguenza. I test
// che richiedono un browser reale (P01-P07, P11, P12) restano gated
// `isRealDeployment` — questo sandbox non può lanciare un browser reale
// (mancano le librerie di sistema). I test P08/P09/P10 sono [no browser]:
// verificano invarianti di CONTENUTO direttamente sui dati puri
// (lib/nextgen/onboarding-slides.ts), quindi girano sempre, anche qui.
//
// Precondizione per P02/P04 dal vivo: ora ESISTE un punto di "restart" lato
// Parent (app/nextgen/profile/impostazioni/preferenze/page.tsx, bottone
// "Rivedi introduzione TRAMA" — REPLAY ENTRY POINT: IMPLEMENTED in questa
// wave), ma i test qui sotto continuano comunque ad auto-prepararsi
// forzando prima uno stato noto (Salta/Completa) invece di passare dal
// replay, per restare indipendenti dal flusso Impostazioni e girare anche
// se il run precedente ha già lasciato il tutorial in uno stato risolto.
// Il replay stesso è coperto da ONB-P13 più sotto.

test.describe("TRAMA — Onboarding Carousel Parent (Private Beta)", () => {
  test("ONB-P01 - Parent prima esperienza -> carousel visibile", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort TRAMA_ONE_ENABLED, e stato tutorial 'family_first_onboarding' non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/4")).toBeVisible();
    await expect(
      dialog.getByText("Sport, musica, centri estivi: cerca per età, zona e settimana, e salva quello che ti interessa.")
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continua" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salta" })).toBeVisible();
  });

  test("ONB-P02 - Parent già completato/saltato -> carousel non compare più", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test in cohort TRAMA_ONE_ENABLED."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Salta" }).click();
      await expect(dialog).toHaveCount(0);
    }

    await page.reload();
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
  });

  test("ONB-P03 - 'Salta' persiste il completamento (chiude subito, resta chiuso dopo reload)", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da saltare in questo run.");
    }
    await dialog.getByRole("button", { name: "Salta" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
  });

  test("ONB-P04 - Completare 4/4 (Continua x3 + CTA finale) persiste il completamento", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da completare in questo run.");
    }

    for (const expectedProgress of ["1/4", "2/4", "3/4"]) {
      await expect(dialog.getByText(expectedProgress)).toBeVisible();
      await dialog.getByRole("button", { name: "Continua" }).click();
    }
    await expect(dialog.getByText("4/4")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: LAST_TITLE })).toBeVisible();
    await dialog.getByRole("button", { name: "Inizia a organizzare" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
  });

  test("ONB-P05 - Partner non vede mai il carousel Parent", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: LAST_TITLE })).toHaveCount(0);
  });

  test("ONB-P06 - Admin non vede il carousel nell'area Admin", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin");
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: LAST_TITLE })).toHaveCount(0);
  });

  // NOTA (§15/ONB-P07): LEGAL_TERMS_GATE è OFF in produzione oggi e questa
  // sessione non lo abilita mai globalmente (regola di governance) — questo
  // test richiede quindi un deploy dedicato con il flag ON per un utente di
  // test specifico, non eseguibile come parte della suite ordinaria.
  // L'ordinamento "legal prima di onboarding" è comunque garantito per
  // COSTRUZIONE (non solo verificato qui): il redirect verso
  // /auth/legal-pending avviene in app/auth/callback/route.ts, PRIMA che
  // l'utente raggiunga mai app/nextgen/layout.tsx (dove il carousel viene
  // recuperato/montato) — vedi TRAMA_PARENT_ONBOARDING_IMPLEMENTATION.md.
  test("ONB-P07 - Legal Gate pending impedisce di raggiungere l'onboarding carousel", async ({ page }) => {
    test.skip(
      true,
      "Richiede un deploy dedicato con LEGAL_TERMS_GATE=ON e un account di test senza legal_acceptances — non eseguibile nella suite ordinaria (il flag resta OFF globalmente per regola di governance). Ordinamento garantito per costruzione: vedi commento sopra."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await expect(page).toHaveURL(/\/auth\/legal-pending/);
    await expect(page.getByRole("dialog", { name: DIALOG_NAME })).toHaveCount(0);
  });

  test("ONB-P11 - 390px: nessun overflow orizzontale evidente", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account in questo run.");
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1); // 1px di tolleranza per arrotondamenti subpixel
  });

  test("ONB-P12 - Tastiera/focus di base: focus iniziale sul dialog, freccia destra avanza, Escape salta", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account in questo run.");
    }
    await expect(dialog.getByText("1/4")).toBeVisible();
    await expect(dialog).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("2/4")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

// ————————————————————————————————————————————————————————————————————————
// [no browser] — girano sempre, anche in questo sandbox: verificano
// invarianti di contenuto e la definizione registry direttamente sui dati,
// nessun mock di Supabase, nessun browser necessario (stesso principio di
// tests/one/planner-first-uncovered.spec.ts).
// ————————————————————————————————————————————————————————————————————————
test.describe("TRAMA — Onboarding Carousel [no browser]", () => {
  test("registry: family_first_onboarding esiste con un solo step sentinella 'carousel'", () => {
    expect(PARENT_ONBOARDING_TUTORIAL_KEY).toBe("family_first_onboarding");
    expect(PARENT_ONBOARDING_STEP_KEY).toBe("carousel");
    const definition = WALKTHROUGH_REGISTRY[PARENT_ONBOARDING_TUTORIAL_KEY];
    expect(definition).toBeTruthy();
    expect(definition.steps.map((s) => s.key)).toEqual(["carousel"]);
    // la versione precedente resta registrata solo per lo storico
    expect(WALKTHROUGH_REGISTRY.parent_beta_onboarding).toBeTruthy();
  });

  test("ONB-P08 [no browser] - Scopri → Organizza → Coordina → Insieme, progress 1/4..4/4", () => {
    expect(ONBOARDING_SLIDES.map((s) => s.eyebrow)).toEqual(["Scopri", "Organizza", "Coordina", "Insieme"]);
    expect(ONBOARDING_SLIDES.map((s) => s.progress)).toEqual(["1/4", "2/4", "3/4", "4/4"]);
    expect(ONBOARDING_SLIDES[ONBOARDING_SLIDES.length - 1].ctaLabel).toBe("Inizia a organizzare");
    for (const s of ONBOARDING_SLIDES.slice(0, -1)) expect(s.ctaLabel).toBe("Continua");
  });

  test("ONB-P09 [no browser] - nessuna slide menziona scoring/AI ranking ('Match 99%' o simili)", () => {
    for (const slide of ONBOARDING_SLIDES) {
      const haystack = `${slide.titleBefore}${slide.titleHighlight}${slide.titleAfter} ${slide.body} ${slide.note} ${slide.pops.map((p) => `${p.title} ${p.subtitle}`).join(" ")}`;
      expect(haystack).not.toMatch(/match\s*\d+%/i);
      expect(haystack.toLowerCase()).not.toContain("scoring");
      expect(haystack.toLowerCase()).not.toContain("ranking");
    }
  });

  test("ONB-P10 [no browser] - nessuna slide menziona pagamento/checkout/carta/transazione", () => {
    const forbidden = /pagamento|checkout|carta di credito|transazione|totale da pagare/i;
    for (const slide of ONBOARDING_SLIDES) {
      const haystack = `${slide.titleBefore}${slide.titleHighlight}${slide.titleAfter} ${slide.body} ${slide.note}`;
      expect(haystack).not.toMatch(forbidden);
    }
  });

  test("ONB-P14 [no browser] - family-first: la prima slide dice che TRAMA serve anche se il centro non è su TRAMA", () => {
    expect(ONBOARDING_SLIDES[0].note).toBe("Anche quando il centro non è ancora su TRAMA.");
    const titles = ONBOARDING_SLIDES.map((s) => `${s.titleBefore}${s.titleHighlight}${s.titleAfter}`);
    expect(titles).toEqual([
      "Trova attività giuste per i tuoi figli.",
      "Tutto nello stesso Planner.",
      "Chi porta, chi riprende.",
      "Fate rete con altre famiglie.",
    ]);
  });

  test("ONB-P15 [no browser] - le funzioni future compaiono SOLO come 'In arrivo' (deleghe)", () => {
    const pops = ONBOARDING_SLIDES.flatMap((s) => s.pops);
    const deleghe = pops.filter((p) => /deleg/i.test(p.title));
    expect(deleghe).toHaveLength(1);
    expect(deleghe[0].comingSoon).toBe(true);
    for (const s of ONBOARDING_SLIDES) {
      expect(`${s.body} ${s.note}`.toLowerCase()).not.toContain("deleg");
    }
  });

  test("ONB-P16 [no browser] - il carousel compare per genitori e Admin piattaforma nell'app famiglie, non per i gestori", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const layout = fs.readFileSync(path.join(__dirname, "../../app/nextgen/layout.tsx"), "utf-8");
    expect(layout).toContain('if (enabled && (realRole === "parent" || realRole === "platform_admin")) {');
    expect(layout).toContain("getWalkthroughProgress(user.id, PARENT_ONBOARDING_TUTORIAL_KEY)");
  });

  test("ONB-P17 [no browser] - animazioni solo CSS, disattivate con prefers-reduced-motion", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const component = fs.readFileSync(path.join(__dirname, "../../components/nextgen/OnboardingCarousel.tsx"), "utf-8");
    const css = fs.readFileSync(path.join(__dirname, "../../app/globals.css"), "utf-8");
    for (const name of ["trama-onb-float", "trama-onb-screen", "trama-onb-text-next", "trama-onb-pop-left", "trama-onb-pop-right"]) {
      expect(css).toContain(`@keyframes ${name}`);
      expect(component).toContain(`motion-safe:animate-[${name}`);
    }
    expect(component).not.toContain("gsap");
  });
});

// ————————————————————————————————————————————————————————————————————————
// ONB-P13 — REPLAY ENTRY POINT (sez. 19/24, FINAL PRE-FREEZE WAVE). Prima di
// questa wave non esisteva alcun modo per un genitore di far ripartire il
// carousel dopo la prima sessione. Gated isRealDeployment come gli altri
// test "dal vivo" di questa suite: verifica solo che il bottone esista e
// che, cliccato, riporti il carousel alla slide 1/4 alla navigazione
// successiva — non duplica ONB-P01/P04 (contenuto slide già coperto lì).
// ————————————————————————————————————————————————————————————————————————
test.describe("TRAMA — Onboarding Carousel Parent — Replay", () => {
  test("ONB-P13 - 'Rivedi introduzione TRAMA' da Preferenze riavvia il carousel dalla slide 1/4", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e account genitore di test in cohort TRAMA_ONE_ENABLED."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/preferenze");

    const replayButton = page.getByRole("button", { name: "Rivedi introduzione TRAMA" });
    if (!(await replayButton.isVisible().catch(() => false))) {
      test.skip(true, "Bottone replay non visibile per questo account (flag/coorte non applicabile in questo run).");
    }
    await replayButton.click();
    await expect(page.getByText(/Introduzione riavviata/)).toBeVisible();

    await page.goto("/nextgen");
    const dialog = page.getByRole("dialog", { name: DIALOG_NAME });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/4")).toBeVisible();
  });
});
