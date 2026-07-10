import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner (Sprint 3)
// Il Planner diventa la feature principale: timeline familiare completa,
// sovrapposizioni, budget impegnato, consigli mirati alla settimana
// prioritaria. Reindirizzato da un link dedicato in Dashboard e da
// NextgenBottomNav (nuovo, solo sotto /nextgen).

test.describe("NEXTGEN - Planner (Sprint 3)", () => {
  test("TC-N13 - /nextgen/planner mostra la timeline completa delle 13 settimane", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/settimane coperte/)).toBeVisible();
    await expect(page.getByText("Timeline della stagione")).toBeVisible();
    await expect(page.getByText("Sett. 1")).toBeVisible();
    await expect(page.getByText("Sett. 13")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N14 - Budget impegnato sempre visibile nel Planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Budget impegnato")).toBeVisible();
  });

  test("TC-N15 - Il link 'Apri il planner completo' in Dashboard porta a /nextgen/planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByText("Apri il planner completo").click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
  });

  test("TC-N16 - NextgenBottomNav permette di raggiungere Home/Planner/Cerca in un tocco", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await page.getByRole("link", { name: "Planner" }).click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
    await page.getByRole("link", { name: "Cerca" }).click();
    await expect(page).toHaveURL(/\/nextgen\/search/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/nextgen$/);
  });
});
