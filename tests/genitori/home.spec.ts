import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Genitori - Home
// Test implementati (selettori presi da app/(main)/page.tsx e components/HomeFeed.tsx).

test.describe("Genitori - Home", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAsRole(page, "parent", "/");
  });

  // TC-013 - Filtro categoria in Home
  test("TC-013 - selezionare una categoria filtra le card, 'Tutte' ripristina", async ({ page }) => {
    await expect(page.getByText("🔥 Popolari vicino a te")).toBeVisible();

    await page.getByText("Sport", { exact: true }).click();
    await expect(page.getByText("🔥 Attività in questa categoria")).toBeVisible();

    await page.getByText("Tutte", { exact: true }).click();
    await expect(page.getByText("🔥 Popolari vicino a te")).toBeVisible();
  });

  // TC-014 - Geolocalizzazione Home (permesso concesso)
  test("TC-014 - 'Usa posizione' con permesso concesso mostra un conteggio di centri", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByText(/centri nel raggio di 5 km/)).toBeVisible({ timeout: 10_000 });
  });

  // TC-015 - Geolocalizzazione negata
  test("TC-015 - 'Usa posizione' con permesso negato mostra un messaggio d'errore leggibile", async ({
    page,
    context,
  }) => {
    await context.clearPermissions(); // permesso non concesso -> il browser blocca/rifiuta
    await page.getByRole("button", { name: "Usa posizione" }).click();
    // L'app non deve crashare: la CTA resta cliccabile e/o appare un messaggio di errore.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // TC-023 - Ricerca con geolocalizzazione da Home -> Cerca
  test("TC-023 - 'Vedi in Cerca' dopo la geolocalizzazione porta a /search con lat/lng", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 });

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByRole("button", { name: "Vedi in Cerca" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Vedi in Cerca" }).click();

    await expect(page).toHaveURL(/\/search\?.*lat=.*lng=/);
  });
  // Priorita: Alta | Precondizioni: Almeno un'attivita inserita in Supabase
  // Passi: Login come genitore -> apri '/'
  // Risultato atteso: Le card 'Popolari' mostrano attivita reali dal DB, non i dati demo
  test.fixme("TC-012 - Home mostra attivita reali", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

});
