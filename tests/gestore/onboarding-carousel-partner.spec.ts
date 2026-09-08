import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";
import {
  PARTNER_ONBOARDING_SLIDES,
  PARTNER_ONBOARDING_REQUEST_OUTCOMES,
} from "../../lib/center/onboarding-slides";

// TRAMA — Partner Private Beta Onboarding Carousel (FINAL PRE-FREEZE WAVE,
// sez. 19-24, 08/09/2026). Prima di questa wave non esisteva alcun carousel
// "perché TRAMA mi serve" lato Partner (solo il tour guidato "dove
// cliccare", activity_creation_partner — distinzione esplicita sez. 18 dello
// spec). Stessa struttura/gating del carousel Parent (tests/nextgen/
// onboarding-carousel.spec.ts): ONB-C-01..05 richiedono un deploy reale
// (questo sandbox non può lanciare un browser reale), ONB-C-06 è
// [no browser] e verifica invarianti di contenuto direttamente sui dati.

test.describe("TRAMA — Onboarding Carousel Partner (Private Beta)", () => {
  test("ONB-C-01 - Partner prima esperienza -> carousel visibile", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account gestore di test in cohort TRAMA_ONE_ENABLED, e stato tutorial 'partner_beta_onboarding' non ancora risolto."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const dialog = page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/4")).toBeVisible();
    await expect(dialog.getByText("Collega la tua offerta alla settimana delle famiglie.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continua" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salta" })).toBeVisible();
  });

  test("ONB-C-02 - Partner già completato/saltato -> carousel non compare più", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account gestore di test in cohort TRAMA_ONE_ENABLED."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const dialog = page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Salta" }).click();
      await expect(dialog).toHaveCount(0);
    }

    await page.reload();
    await expect(page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." })).toHaveCount(0);
  });

  test("ONB-C-03 - Completare 4/4 (Continua x3 + CTA finale) persiste il completamento", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, account gestore di test in cohort, e carousel non ancora risolto."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const dialog = page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." });
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, "Carousel già risolto per questo account: nessuna 'prima esperienza' da completare in questo run.");
    }

    for (const expectedProgress of ["1/4", "2/4", "3/4"]) {
      await expect(dialog.getByText(expectedProgress)).toBeVisible();
      await dialog.getByRole("button", { name: "Continua" }).click();
    }
    await expect(dialog.getByText("4/4")).toBeVisible();
    await expect(dialog.getByText("Il lavoro non finisce quando accetti.")).toBeVisible();
    await dialog.getByRole("button", { name: "Configura il tuo centro" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." })).toHaveCount(0);
  });

  test("ONB-C-04 - Genitore non vede mai il carousel Partner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await expect(page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." })).toHaveCount(0);
    await expect(page.getByText("Il lavoro non finisce quando accetti.")).toHaveCount(0);
  });

  // ONB-C-05 — REPLAY ENTRY POINT (sez. 19/24): "Rivedi introduzione TRAMA"
  // in Preferenze Partner (app/center/account/preferenze/page.tsx), accanto
  // al tour guidato preesistente (invariato).
  test("ONB-C-05 - 'Rivedi introduzione TRAMA' da Preferenze riavvia il carousel dalla slide 1/4", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e account gestore di test in cohort TRAMA_ONE_ENABLED."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/account/preferenze");

    const replayButton = page.getByRole("button", { name: "Rivedi introduzione TRAMA" });
    if (!(await replayButton.isVisible().catch(() => false))) {
      test.skip(true, "Bottone replay non visibile per questo account (flag/coorte non applicabile in questo run).");
    }
    await replayButton.click();
    await expect(page.getByText(/Introduzione riavviata/)).toBeVisible();

    await page.goto("/center");
    const dialog = page.getByRole("dialog", { name: "TRAMA non sostituisce il tuo gestionale." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1/4")).toBeVisible();
  });
});

// ————————————————————————————————————————————————————————————————————————
// [no browser] — girano sempre, anche in questo sandbox: stesso principio di
// tests/nextgen/onboarding-carousel.spec.ts (ONB-P08..10).
// ————————————————————————————————————————————————————————————————————————
test.describe("TRAMA — Onboarding Carousel Partner [no browser]", () => {
  test("registry: partner_beta_onboarding esiste con un solo step sentinella 'carousel'", () => {
    const definition = WALKTHROUGH_REGISTRY.partner_beta_onboarding;
    expect(definition).toBeTruthy();
    expect(definition.steps.map((s) => s.key)).toEqual(["carousel"]);
  });

  test("ONB-C-06 [no browser] - la slide 3 (richieste) preserva i 4 esiti reali (mai solo Accetta/Rifiuta)", () => {
    // Invariante esplicito dello spec: le richieste NON sono mai solo
    // binarie accetta/rifiuta (esiste anche la conferma parziale a giorni e
    // la lista d'attesa, entrambe feature reali già implementate lato
    // Partner) — un carousel che ne mostrasse solo due mentirebbe sul
    // prodotto reale.
    const slide3 = PARTNER_ONBOARDING_SLIDES[2];
    expect(slide3.key).toBe("request");
    expect(PARTNER_ONBOARDING_REQUEST_OUTCOMES.map((o) => o.label)).toEqual([
      "Accetta",
      "Rifiuta",
      "Conferma parziale",
      "Lista d'attesa",
    ]);
  });

  test("nessuna slide menziona scoring/AI ranking o pagamento/checkout (stesso invariante del carousel Parent)", () => {
    const forbiddenScoring = /match\s*\d+%|scoring|ranking/i;
    const forbiddenPayment = /pagamento|checkout|carta di credito|transazione|totale da pagare/i;
    for (const slide of PARTNER_ONBOARDING_SLIDES) {
      const haystack = `${slide.title} ${slide.body} ${slide.microCopy ?? ""}`;
      expect(haystack).not.toMatch(forbiddenScoring);
      expect(haystack).not.toMatch(forbiddenPayment);
    }
  });

  test("4 slide totali, progress 1/4..4/4 nell'ordine atteso", () => {
    expect(PARTNER_ONBOARDING_SLIDES.map((s) => s.progress)).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });
});
