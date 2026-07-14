import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Admin - Dashboard
// NOTA: "volutamente demo" (task #19) - dati sempre da lib/mock-data.ts.
// Convertito da gotoAsRole a loginAs: /admin reindirizza a /auth/login se
// Supabase è configurato e non c'è sessione reale.

test.describe("Admin - Dashboard", () => {
  // TC-082 - Dashboard Admin
  test("TC-082 - /admin mostra la panoramica piattaforma", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard piattaforma" })).toBeVisible();
    await expect(page.getByText("Panoramica su tutti i centri e le attività di TRAMA")).toBeVisible();
  });

  // TC-214 - REGRESSIONE segnalata da Fabrizio con screenshot: "Dashboard
  // piattaforma" e il sottotitolo erano illeggibili (text-ink #1A1D2E su
  // bg-navy, stesso colore esatto — visibili solo selezionando il testo).
  // toBeVisible() da solo non l'avrebbe intercettato (il testo era comunque
  // nel DOM/accessibility tree) — qui verifichiamo il colore calcolato per
  // assicurarci che non torni ad essere uguale allo sfondo scuro del pannello.
  test("TC-214 - Titolo Dashboard Admin ha testo chiaro leggibile sullo sfondo navy", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin");
    const heading = page.getByRole("heading", { name: "Dashboard piattaforma" });
    const color = await heading.evaluate((el) => getComputedStyle(el).color);
    // text-white -> rgb(255, 255, 255). Il bug era rgb(26, 29, 46) (#1A1D2E,
    // identico allo sfondo bg-navy del pannello Admin).
    expect(color).toBe("rgb(255, 255, 255)");
  });

  // TC-216 - Branding: header sidebar Admin usa il vero logo TRAMA (variante
  // WHITE, vedi DashboardLayout.tsx#BrandMark) al posto dell'emoji "🛠️"
  // placeholder — leggibile sullo sfondo scuro bg-navy della sidebar.
  test("TC-216 - Sidebar Admin mostra il logo WHITE invece dell'emoji", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "platform_admin");
    await page.goto("/admin");

    await expect(page.locator('img[src="/brand/trama-logo-mark-white.png"]').first()).toBeVisible();
    await expect(page.getByText("Admin", { exact: true }).first()).toBeVisible();
  });
});
