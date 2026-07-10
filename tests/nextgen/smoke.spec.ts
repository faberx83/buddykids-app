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
});
