import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";
import { ONBOARDING_SLIDES, ONBOARDING_FLOW_STAGES } from "../../lib/nextgen/onboarding-slides";

// TRAMA — Parent Private Beta Onboarding Carousel.
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
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort TRAMA_ONE_ENABLED, e stato tutorial 'parent_beta_onboarding' non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/5")).toBeVisible();
    await expect(dialog.getByText("Le loro settimane non devono esserlo.")).toBeVisible();
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

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Salta" }).click();
      await expect(dialog).toHaveCount(0);
    }

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
  });

  test("ONB-P03 - 'Salta' persiste il completamento (chiude subito, resta chiuso dopo reload)", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da saltare in questo run.");
    }
    await dialog.getByRole("button", { name: "Salta" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
  });

  test("ONB-P04 - Completare 5/5 (Continua x4 + CTA finale) persiste il completamento", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da completare in questo run.");
    }

    for (const expectedProgress of ["1/5", "2/5", "3/5", "4/5"]) {
      await expect(dialog.getByText(expectedProgress)).toBeVisible();
      await dialog.getByRole("button", { name: "Continua" }).click();
    }
    await expect(dialog.getByText("5/5")).toBeVisible();
    await expect(dialog.getByText("Condividi. Coordina. Intreccia.")).toBeVisible();
    await dialog.getByRole("button", { name: "Inizia a organizzare" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
  });

  test("ONB-P05 - Partner non vede mai il carousel Parent", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
    await expect(page.getByText("Condividi. Coordina. Intreccia.")).toHaveCount(0);
  });

  test("ONB-P06 - Admin non vede mai il carousel Parent", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin");
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
    await expect(page.getByText("Condividi. Coordina. Intreccia.")).toHaveCount(0);
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
    await expect(page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." })).toHaveCount(0);
  });

  test("ONB-P11 - 390px: nessun overflow orizzontale evidente", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account genitore di test in cohort, e carousel non ancora risolto."
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
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

    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
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

  test("ONB-P08 [no browser] - la slide 4 (dal centro alla giornata) non implica conferma istantanea: 'Stato' resta una tappa distinta", () => {
    // FINAL PRE-FREEZE WAVE (08/09/2026) — invariante riscritto: la vecchia
    // slide "richiesta" (ONBOARDING_REQUEST_FLOW, "Tu chiedi. Il centro
    // risponde.") non esiste più (copy sostituita integralmente). L'intento
    // originale del test — non lasciar intendere che una prenotazione sia
    // confermata all'istante — è preservato verificando che il flusso
    // ONBOARDING_FLOW_STAGES della nuova slide 4 ("Dal centro alla
    // giornata.") contenga ancora una tappa "Stato" distinta da "Centro" e
    // "Presenza".
    const slide4 = ONBOARDING_SLIDES[3];
    expect(slide4.key).toBe("from-center-to-day");
    expect(slide4.title).toBe("Dal centro alla giornata.");
    expect(ONBOARDING_FLOW_STAGES.some((s) => s.label === "Stato")).toBe(true);
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

  test("Slide 2 usa il titolo DEFINITIVO approvato in questa wave ('Quando resta un buco, TRAMA ti aiuta a riempirlo.')", () => {
    // FINAL PRE-FREEZE WAVE (08/09/2026) — titolo precedente ("Le tue
    // settimane, finalmente visibili") sostituito con la nuova copy
    // verbatim dallo spec Fabrizio; invariante aggiornato di conseguenza.
    const slide2 = ONBOARDING_SLIDES[1];
    expect(slide2.title).toBe("Quando resta un buco, TRAMA ti aiuta a riempirlo.");
  });

  test("5 slide totali, progress 1/5..5/5 nell'ordine atteso", () => {
    expect(ONBOARDING_SLIDES.map((s) => s.progress)).toEqual(["1/5", "2/5", "3/5", "4/5", "5/5"]);
  });
});

// ————————————————————————————————————————————————————————————————————————
// ONB-P13 — REPLAY ENTRY POINT (sez. 19/24, FINAL PRE-FREEZE WAVE). Prima di
// questa wave non esisteva alcun modo per un genitore di far ripartire il
// carousel dopo la prima sessione. Gated isRealDeployment come gli altri
// test "dal vivo" di questa suite: verifica solo che il bottone esista e
// che, cliccato, riporti il carousel alla slide 1/5 alla navigazione
// successiva — non duplica ONB-P01/P04 (contenuto slide già coperto lì).
// ————————————————————————————————————————————————————————————————————————
test.describe("TRAMA — Onboarding Carousel Parent — Replay", () => {
  test("ONB-P13 - 'Rivedi introduzione TRAMA' da Preferenze riavvia il carousel dalla slide 1/5", async ({ page }) => {
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
    const dialog = page.getByRole("dialog", { name: "Le attività dei tuoi figli sono sparse." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/5")).toBeVisible();
  });
});
