import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";
import {
  ONBOARDING_SLIDES,
  ONBOARDING_REQUEST_FLOW,
} from "../../lib/nextgen/onboarding-slides";

// TRAMA — Parent Private Beta Onboarding Carousel (implementazione finale).
// Copertura richiesta: ONB-P01..P12. I test che richiedono un browser reale
// (P01-P07, P11, P12) sono gated `isRealDeployment` — questo sandbox non può
// lanciare un browser reale (mancano le librerie di sistema, vedi
// TRAMA_PARENT_ONBOARDING_IMPLEMENTATION.md). I test P08/P09/P10 sono invece
// [no browser]: verificano invarianti di CONTENUTO direttamente sui dati
// puri (lib/nextgen/onboarding-slides.ts), quindi girano sempre, anche qui.
//
// Precondizione per P02/P04 dal vivo: nessun punto di "restart" lato Parent
// esiste ancora (REPLAY ENTRY POINT: NOT IMPLEMENTED, vedi doc) — i test si
// auto-preparano forzando prima uno stato noto (Salta/Completa) invece di
// assumere un account "vergine", cosi restano eseguibili anche se il run
// precedente ha già lasciato il tutorial in uno stato risolto.

test.describe("TRAMA — Onboarding Carousel Parent (Private Beta)", () => {
  test("ONB-P01 - Parent prima esperienza -> carousel visibile", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort TRAMA_ONE_ENABLED, e stato tutorial 'parent_beta_onboarding' non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/5")).toBeVisible();
    await expect(
      dialog.getByText("Organizza attività, settimane e impegni dei tuoi figli in un unico posto.")
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

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Salta" }).click();
      await expect(dialog).toHaveCount(0);
    }

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
  });

  test("ONB-P03 - 'Salta' persiste il completamento (chiude subito, resta chiuso dopo reload)", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da saltare in questo run.");
    }
    await dialog.getByRole("button", { name: "Salta" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
  });

  test("ONB-P04 - Completare 5/5 (Continua x4 + CTA finale) persiste il completamento", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da completare in questo run.");
    }

    for (const expectedProgress of ["1/5", "2/5", "3/5", "4/5"]) {
      await expect(dialog.getByText(expectedProgress)).toBeVisible();
      await dialog.getByRole("button", { name: "Continua" }).click();
    }
    await expect(dialog.getByText("5/5")).toBeVisible();
    await expect(dialog.getByText("Adesso prova TRAMA")).toBeVisible();
    await dialog.getByRole("button", { name: "Inizia a esplorare" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
  });

  test("ONB-P05 - Partner non vede mai il carousel Parent", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
    await expect(page.getByText("Adesso prova TRAMA")).toHaveCount(0);
  });

  test("ONB-P06 - Admin non vede mai il carousel Parent", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin");
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
    await expect(page.getByText("Adesso prova TRAMA")).toHaveCount(0);
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
    await expect(page.getByRole("dialog", { name: "Benvenuto in TRAMA" })).toHaveCount(0);
  });

  test("ONB-P11 - 390px: nessun overflow orizzontale evidente", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
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

    const dialog = page.getByRole("dialog", { name: "Benvenuto in TRAMA" });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account in questo run.");
    }
    await expect(dialog.getByText("1/5")).toBeVisible();
    await expect(dialog).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("2/5")).toBeVisible();

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
  test("registry: parent_beta_onboarding esiste con un solo step sentinella 'carousel'", () => {
    const definition = WALKTHROUGH_REGISTRY.parent_beta_onboarding;
    expect(definition).toBeTruthy();
    expect(definition.steps.map((s) => s.key)).toEqual(["carousel"]);
  });

  test("ONB-P08 [no browser] - la slide 4 (richiesta) contiene 'In attesa'", () => {
    expect(ONBOARDING_REQUEST_FLOW).toContain("In attesa");
    const slide4 = ONBOARDING_SLIDES[3];
    expect(slide4.key).toBe("request");
    expect(slide4.title).toBe("Tu chiedi. Il centro risponde.");
  });

  test("ONB-P09 [no browser] - nessuna slide menziona scoring/AI ranking ('Match 99%' o simili)", () => {
    for (const slide of ONBOARDING_SLIDES) {
      const haystack = `${slide.title} ${slide.body} ${slide.microCopy ?? ""}`;
      expect(haystack).not.toMatch(/match\s*\d+%/i);
      expect(haystack.toLowerCase()).not.toContain("scoring");
      expect(haystack.toLowerCase()).not.toContain("ranking");
    }
  });

  test("ONB-P10 [no browser] - nessuna slide menziona pagamento/checkout/carta/transazione", () => {
    const forbidden = /pagamento|checkout|carta di credito|transazione|totale da pagare/i;
    for (const slide of ONBOARDING_SLIDES) {
      const haystack = `${slide.title} ${slide.body} ${slide.microCopy ?? ""}`;
      expect(haystack).not.toMatch(forbidden);
    }
  });

  test("Slide 2 usa il titolo DEFINITIVO approvato ('Le tue settimane, finalmente visibili')", () => {
    const slide2 = ONBOARDING_SLIDES[1];
    expect(slide2.title).toBe("Le tue settimane, finalmente visibili");
    expect(slide2.title).not.toBe("La tua estate, finalmente visibile");
  });

  test("5 slide totali, progress 1/5..5/5 nell'ordine atteso", () => {
    expect(ONBOARDING_SLIDES.map((s) => s.progress)).toEqual(["1/5", "2/5", "3/5", "4/5", "5/5"]);
  });
});
