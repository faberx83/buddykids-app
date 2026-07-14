import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Setup (Sprint 0)
// Nuova cartella di test separata da tests/genitori|gestore|admin (LEGACY):
// nessuna modifica ai test esistenti, nessun rischio di regressione sulla
// suite LEGACY. Verifica solo il plumbing di questo sprint: routing,
// autenticazione condivisa e guard sui ruoli nel nuovo namespace /nextgen.

test.describe("NEXTGEN - Setup (Sprint 0)", () => {
  test("TC-N01 - /nextgen è raggiungibile da un genitore autenticato e mostra il badge NextGen", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await expect(page.getByText("NextGen")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N02 - /nextgen/center è raggiungibile da un gestore e mostra il centro collegato", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/nextgen/center");
    await expect(page.getByText("NextGen")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N03 - /nextgen/admin è raggiungibile da un platform_admin", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/nextgen/admin");
    await expect(page.getByText("NextGen")).toBeVisible();
  });

  test("TC-N04 - Un genitore che apre /nextgen/center viene rediretto (nessun accesso non autorizzato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/center");
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  test("TC-N05 - Un genitore che apre /nextgen/admin viene rediretto (nessun accesso non autorizzato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/admin");
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  test("TC-N06 - Un utente non autenticato che apre /nextgen viene rediretto al login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await page.goto("/nextgen");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // Segnalazione di Fabrizio ("manca il logo in alto a sinistra"): prima
  // NESSUNA pagina NEXTGEN mostrava il marchio TRAMA. Primo tentativo con
  // una barra fissa in alto (NextgenTopBar) SCARTATO da Fabrizio ("non
  // voglio un banner fisso..vorrei una icona magari di fianco a 'Ciao
  // Nome'") — sostituito con l'icona inline accanto al titolo di ogni
  // pagina (Home: accanto a "Ciao [Nome]" in HomeDashboardClient.tsx;
  // Planner/Ricerca/Famiglia/Indirizzi: PageHeader.tsx#showBrandIcon;
  // Community: inline nell'h1, non usa PageHeader).
  //
  // REGOLA DI COLORE (da Fabrizio, valida per tutti gli sprint successivi):
  // icona A COLORI lato genitore (qui), navy lato gestore, bianca su navy
  // lato admin (vedi components/dashboard/DashboardLayout.tsx#BrandMark per
  // gli altri due tenant) — usare SEMPRE /brand/trama-logo-mark.png (non la
  // variante -navy) in tutto ciò che è genitore/NEXTGEN.
  test("TC-N89 - Il marchio TRAMA A COLORI compare accanto al titolo su ogni pagina NEXTGEN (Home e Community)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");

    await page.goto("/nextgen");
    await expect(page.locator('img[src="/brand/trama-logo-mark.png"]')).toBeVisible();

    await page.goto("/nextgen/community");
    await expect(page.locator('img[src="/brand/trama-logo-mark.png"]')).toBeVisible();
  });

  // SPRINT CORRETTIVO (feedback Fabrizio): "l'icona della pwa e' piccola" +
  // splash screen iOS personalizzato (icona+claim su bianco) prima assente
  // per ogni tenant — vedi lib/tenant.ts#splashLinks. Qui verifichiamo solo
  // che i tag <link rel="apple-touch-startup-image"> siano presenti nello
  // <head> per NEXTGEN (le stesse dimensioni sono condivise da tutti i
  // tenant, vedi SPLASH_SIZES) — non e' verificabile via Playwright come
  // Safari sceglie/renderizza lo splash in fase di avvio da home screen.
  test("TC-N93 - /nextgen include i tag apple-touch-startup-image per lo splash iOS", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const splashLinkCount = await page.locator('link[rel="apple-touch-startup-image"]').count();
    expect(splashLinkCount).toBeGreaterThanOrEqual(6);
    await expect(page.locator('link[rel="apple-touch-startup-image"]').first()).toHaveAttribute(
      "href",
      /\/splash\/nextgen-\d+x\d+\.png/
    );
  });
});
