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
    await expect(page.getByText("Panoramica su tutti i centri e le attività di BuddyKids")).toBeVisible();
  });
});
