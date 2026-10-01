import { test, expect, gotoAsRole, loginAs, isRealDeployment } from "../fixtures/roles";
import type { Page, Locator } from "@playwright/test";

// TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026). "Il mio centro"
// (/center/profile): header card su mobile + CTA "Vedi come ti vedono le
// famiglie" → anteprima famiglia (/activity/<slug>?anteprima=partner) →
// "Torna al tuo centro".
//
// Due modalità, come il resto della suite:
//  - locale/mock (dev server senza Supabase): ruolo demo center_admin, centro
//    demo "centro-sportivo-lido" (attività "summer-camp-acquatico");
//  - deploy reale (TEST_BASE_URL): login reale col Gestore di test.
// Il caso "nome molto lungo" sostituisce SOLO il testo del nome nel DOM per
// misurare il layout: nessun dato viene scritto.
//
// Comando locale: npx playwright test tests/gestore/profilo-centro-mobile.spec.ts

const CTA_NAME = "Vedi come ti vedono le famiglie";
const LONG_NAME =
  "Centro estivo prova candidatura — Associazione Sportiva Dilettantistica Polisportiva Quarto Cagnino Milano";
const LONG_CITY = "Milano, Quarto Cagnino — Municipio 7 (zona San Siro / Baggio)";
const MOBILE_WIDTHS = [360, 390, 430];

async function openProfile(page: Page) {
  if (isRealDeployment) {
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");
  } else {
    await gotoAsRole(page, "center_admin", "/center/profile");
  }
  await expect(page.getByTestId("center-profile-header")).toBeVisible();
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, "elemento non renderizzato").not.toBeNull();
  return b!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectHeaderClean(page: Page, viewportWidth: number) {
  const header = page.getByTestId("center-profile-header");
  const name = page.getByTestId("center-profile-name");
  const headerBox = await box(header);
  const nameBox = await box(name);

  // Nome mai tagliato né fuori dalla sua colonna.
  const nameOverflow = await name.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(nameOverflow).toBeLessThanOrEqual(0);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 0.5);

  const cta = page.getByRole("link", { name: CTA_NAME });
  if (await cta.isVisible().catch(() => false)) {
    const ctaBox = await box(cta);
    // CTA sotto il titolo (impilata), mai sovrapposta.
    expect(ctaBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height);
    // CTA dentro la card e dentro lo schermo.
    expect(ctaBox.x).toBeGreaterThanOrEqual(headerBox.x - 0.5);
    expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 0.5);
    expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(viewportWidth);
    // Touch target adeguato.
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalOverflow(page);
}

test.describe("Gestore - Il mio centro - header mobile", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`PCM-01 - ${width}px nome corto/reale: nessuna sovrapposizione, nessun overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openProfile(page);
      await expectHeaderClean(page, width);
    });

    test(`PCM-02 - ${width}px nome e città molto lunghi: vanno a capo, CTA sotto, nessun overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await openProfile(page);
      await page.getByTestId("center-profile-name").evaluate((el, t) => {
        el.textContent = t;
      }, LONG_NAME);
      await page
        .getByTestId("center-profile-name")
        .locator("xpath=following-sibling::div[1]")
        .evaluate((el, t) => {
          el.textContent = `${t} · Pubblicato`;
        }, LONG_CITY);
      await expectHeaderClean(page, width);
      // il nome lungo occupa più righe invece di essere rimpicciolito
      const lineCount = await page
        .getByTestId("center-profile-name")
        .evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
      expect(lineCount).toBeGreaterThan(1);
      const fontSize = await page
        .getByTestId("center-profile-name")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(18); // text-lg invariato
    });
  }

  test("PCM-03 - desktop 1280px: layout orizzontale invariato (CTA a destra, sulla stessa riga del nome)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openProfile(page);
    const cta = page.getByRole("link", { name: CTA_NAME });
    test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività: nessuna CTA da misurare.");
    const nameBox = await box(page.getByTestId("center-profile-name"));
    const ctaBox = await box(cta);
    expect(ctaBox.x).toBeGreaterThan(nameBox.x + nameBox.width - 1);
    // stessa riga: i due box si sovrappongono in verticale
    expect(ctaBox.y).toBeLessThan(nameBox.y + nameBox.height + 24);
    const whiteSpace = await cta.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe("nowrap");
  });
});

test.describe("Gestore - Il mio centro - anteprima famiglia", () => {
  test("PCM-04 - 390px: CTA semantica, stessa scheda, apre l'anteprima del PROPRIO centro", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page);
    const cta = page.getByRole("link", { name: CTA_NAME });
    test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività: coperto da CENTER-P-02 (stato B).");

    await expect(cta).not.toHaveAttribute("target", "_blank");
    const href = (await cta.getAttribute("href"))!;
    expect(href).toMatch(/^\/activity\/[^?]+\?anteprima=partner$/);

    // focus da tastiera raggiungibile
    await cta.focus();
    await expect(cta).toBeFocused();

    const pagesBefore = context.pages().length;
    await cta.click();
    await page.waitForURL((url) => url.pathname.startsWith("/activity/") && url.searchParams.get("anteprima") === "partner");
    expect(context.pages().length).toBe(pagesBefore); // nessuna nuova scheda

    await expect(page.getByTestId("family-preview-bar")).toBeVisible();
    await expect(page.getByTestId("family-preview-booking-disabled")).toBeDisabled();
    await expect(page.locator("body")).not.toContainText("Application error");
    await expectNoHorizontalOverflow(page);
  });

  test("PCM-05 - 'Torna al tuo centro' riporta a Il mio centro, stessa sessione e ruolo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page);
    const cta = page.getByRole("link", { name: CTA_NAME });
    test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività.");
    await cta.click();
    await expect(page.getByTestId("family-preview-bar")).toBeVisible();

    await page.getByTestId("family-preview-back").click();
    await page.waitForURL((url) => url.pathname === "/center/profile");
    await expect(page.getByTestId("center-profile-header")).toBeVisible();
    await expect(page.getByRole("link", { name: CTA_NAME })).toBeVisible();
  });

  test("PCM-06 - freccia Indietro della scheda in anteprima → Il mio centro (anche dopo refresh)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page);
    const cta = page.getByRole("link", { name: CTA_NAME });
    test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività.");
    await cta.click();
    await expect(page.getByTestId("family-preview-bar")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Torna al tuo centro" }).click();
    await page.waitForURL((url) => url.pathname === "/center/profile");
  });

  test("PCM-07 - attività di UN ALTRO centro con ?anteprima=partner: nessuna anteprima, pagina pubblica normale", async ({
    page,
  }) => {
    const foreignSlug = isRealDeployment ? process.env.TEST_FOREIGN_ACTIVITY_SLUG : "laboratorio-arti-creative";
    test.skip(!foreignSlug, "Imposta TEST_FOREIGN_ACTIVITY_SLUG (attività di un centro diverso da quello di test).");
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfile(page);
    await page.goto(`/activity/${foreignSlug}?anteprima=partner`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByTestId("family-preview-bar")).toHaveCount(0);
    await expect(page.getByTestId("family-preview-booking-disabled")).toHaveCount(0);
  });

  test("PCM-08 - genitore con ?anteprima=partner sull'attività del centro: nessuna anteprima", async ({
    page,
    browser,
  }) => {
    test.skip(
      !isRealDeployment,
      "In modalità mock il contesto centro è sempre quello demo (nessuna sessione reale): coperto da PFP-05/06."
    );
    await openProfile(page);
    const cta = page.getByRole("link", { name: CTA_NAME });
    test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività.");
    const href = (await cta.getAttribute("href"))!;

    const parentContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const parentPage = await parentContext.newPage();
    await loginAs(parentPage, "parent");
    const response = await parentPage.goto(href);
    expect(response?.status()).toBe(200);
    await expect(parentPage.locator("body")).not.toContainText("Application error");
    await expect(parentPage.getByTestId("family-preview-bar")).toHaveCount(0);
    await expect(parentPage.getByTestId("family-preview-booking-disabled")).toHaveCount(0);
    // la pagina pubblica normale c'è davvero (freccia Indietro standard)
    await expect(parentPage.getByRole("button", { name: "Indietro" })).toBeVisible();
    await parentContext.close();
  });

  // PRE-APPLY REVIEW (01/10/2026) — test server-side REALE: richiesta HTTP
  // senza cookie (anonimo) alla stessa URL dell'anteprima. Deve rispondere 200
  // senza redirect al login, senza barra di anteprima, identica alla pagina
  // pubblica senza parametro. In mock il contesto centro è sempre quello demo,
  // quindi lì si usa un'attività di un altro centro.
  test("PCM-09 - anonimo (HTTP senza cookie) con ?anteprima=partner: 200, nessuna anteprima, pagina pubblica", async ({
    page,
    playwright,
  }) => {
    let path: string;
    if (isRealDeployment) {
      await openProfile(page);
      const cta = page.getByRole("link", { name: CTA_NAME });
      test.skip(!(await cta.isVisible().catch(() => false)), "Centro di test senza attività.");
      path = (await cta.getAttribute("href"))!;
    } else {
      path = "/activity/laboratorio-arti-creative?anteprima=partner";
    }
    const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
    const withParam = await anon.get(path, { maxRedirects: 0 });
    const withoutParam = await anon.get(path.split("?")[0], { maxRedirects: 0 });
    expect(withParam.status()).toBe(200);
    expect(withoutParam.status()).toBe(200);
    const html = await withParam.text();
    expect(html).not.toContain('data-testid="family-preview-bar"');
    expect(html).not.toContain('data-testid="family-preview-booking-disabled"');
    expect(html).not.toContain("Application error");
    expect(html).toContain('aria-label="Indietro"');
    await anon.dispose();
  });
});
