import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner, hub "Logistica & Famiglia" (Sprint correttivo)
// Prima "Indirizzi di famiglia"/"Famiglia"/"Gestisci prenotazioni" comparivano
// come 3 link separati, ripetuti sotto OGNI modalità del Planner
// (Organizzazione/Calendario/Mappa/Budget/Gruppi) — segnalazione di Fabrizio:
// "vanno riportate in una unica pagina". Ora un solo link "Logistica &
// Famiglia" porta a /nextgen/planner/logistica, un hub con 4 card. Vedi
// app/nextgen/planner/logistica/LogisticaClient.tsx per il dettaglio.

test.describe("NEXTGEN - Planner, hub Logistica & Famiglia", () => {
  test("TC-N94 - Il Planner mostra un solo link 'Logistica & Famiglia' (non piu' 3 link separati)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByRole("link", { name: /Logistica & Famiglia/ })).toBeVisible();
    // I vecchi link diretti non devono piu' comparire in questa pagina.
    await expect(page.getByRole("link", { name: "📍 Indirizzi di famiglia" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Gestisci prenotazioni/ })).toHaveCount(0);
  });

  test("TC-N95 - L'hub Logistica mostra le 4 card e porta alle pagine giuste", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/logistica");

    await expect(page.getByText("Indirizzi di famiglia")).toBeVisible();
    await expect(page.getByText("Famiglia", { exact: true })).toBeVisible();
    await expect(page.getByText("Condivisione piano")).toBeVisible();
    await expect(page.getByText("Le tue prenotazioni")).toBeVisible();

    await page.getByText("Indirizzi di famiglia").click();
    await expect(page).toHaveURL(/\/nextgen\/planner\/indirizzi/);
  });

  test("TC-N96 - 'Condivisione piano' nell'hub apre il Planner gia' in modalita' Calendario", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/logistica");

    await page.getByText("Condivisione piano").click();
    await expect(page).toHaveURL(/\/nextgen\/planner\?mode=calendario/);
    // In modalita' Calendario compare il selettore Mese/Settimana.
    await expect(page.getByRole("button", { name: "Mese" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settimana" })).toBeVisible();
  });
});
