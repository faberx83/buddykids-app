import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Admin - Dashboard
// NOTA: "volutamente demo" (task #19) - dati sempre da lib/mock-data.ts.

test.describe("Admin - Dashboard", () => {
  // TC-082 - Dashboard Admin
  test("TC-082 - /admin mostra la panoramica piattaforma", async ({ page }) => {
    await gotoAsRole(page, "platform_admin", "/admin");
    await expect(page.getByRole("heading", { name: "Dashboard piattaforma" })).toBeVisible();
    await expect(page.getByText("Panoramica su tutti i centri e le attività di BuddyKids")).toBeVisible();
  });
});
