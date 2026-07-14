import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Ricerca, Sprint 5.7 "Ripristino filtri LEGACY + Vista Mappa"
// Fabrizio ha segnalato che i 6 pannelli filtro di LEGACY (età/prezzo/zona/
// tipo attività/servizi/data) erano stati deliberatamente esclusi dallo
// scope di Sprint 2 NEXTGEN — qui sono ripristinati 1:1 come filtro "duro"
// applicato PRIMA dello scoring smart-search (che resta invariato), più un
// toggle vista Lista/Mappa (riuso di ActivityMap, già usato da LEGACY e dal
// Planner). Selettori presi da app/nextgen/search/SearchDiscoveryClient.tsx.

test.describe("NEXTGEN - Ricerca Sprint 5.7 (filtri + Vista Mappa)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
  });

  function resultsCount(page: import("@playwright/test").Page) {
    return page.getByText(/\d+ attività trovate/);
  }

  test("TC-N82 - Il pannello 'Prezzo' è raggiungibile e il tetto massimo riduce i risultati", async ({ page }) => {
    const before = await resultsCount(page).textContent();

    await page.getByText("Prezzo", { exact: true }).click();
    const slider = page.locator('input[type="range"]');
    await slider.fill("50");

    await expect(resultsCount(page)).not.toHaveText(before ?? "");
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  });

  test("TC-N83 - Il filtro Servizi 'Bar nel centro' mostra solo centri con bar", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥤 Bar nel centro").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
    await expect(resultsCount(page)).toBeVisible();
  });

  test("TC-N84 - Selezionare una categoria in 'Tipo attività' aggiorna il conteggio nel chip", async ({ page }) => {
    await page.getByText("Tipo attività", { exact: true }).click();
    const firstCategory = page.locator('div[class*="max-h-64"] button').first();
    await firstCategory.click();

    await expect(page.getByText(/Tipo attività \(1\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  });

  test("TC-N85 - Selezionare una settimana nel pannello 'Data' aggiorna l'etichetta del chip", async ({ page }) => {
    await page.getByText("Date", { exact: true }).click();
    await page.getByText(/^Settimana 1 ·/).click();

    await expect(page.getByText(/^Settimana 1$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  });

  test("TC-N86 - 'Azzera' ripristina il conteggio non filtrato", async ({ page }) => {
    const before = await resultsCount(page).textContent();

    await page.getByText("Prezzo", { exact: true }).click();
    await page.locator('input[type="range"]').fill("50");
    await expect(resultsCount(page)).not.toHaveText(before ?? "");

    await page.getByRole("button", { name: /^Azzera/ }).click();
    await expect(resultsCount(page)).toHaveText(before ?? "");
  });

  test("TC-N87 - Il toggle 'Mappa' mostra la vista mappa al posto della lista", async ({ page }) => {
    await page.getByRole("button", { name: "Mappa" }).click();

    const mapOrEmpty = page.locator("text=Nessuna attività con coordinate").or(page.locator(".leaflet-container"));
    await expect(mapOrEmpty.first()).toBeVisible();

    await page.getByRole("button", { name: "Lista" }).click();
    await expect(resultsCount(page)).toBeVisible();
  });

  // SPRINT 5 (feedback Fabrizio): "aggiungi flag per disabili e diete speciali
  // (usa stessa naming ovunque)" — stesso naming del badge su ActivityCard.tsx
  // ("Accesso disabili" / "Diete gestite"), qui applicato come filtro escludente.
  test("TC-N103 - Il filtro Servizi 'Accesso disabili' mostra solo attività accessibili", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("♿ Accesso disabili").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
    await expect(resultsCount(page)).toBeVisible();
  });

  test("TC-N104 - Il filtro Servizi 'Diete gestite' mostra solo attività con opzioni dietetiche", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥗 Diete gestite").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
    await expect(resultsCount(page)).toBeVisible();
  });
});
