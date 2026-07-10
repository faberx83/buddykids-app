import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Admin - Nuovi pannelli cross-centro
// NUOVA FUNZIONALITÀ (Fabrizio ha chiesto cosa manca lato Admin tra le
// funzionalità aggiunte di recente — ticketing, presenze/check-in,
// preferiti — e ha scelto tutte e 3 le proposte): tre pagine di sola
// consultazione che aggregano dati su TUTTI i centri (is_platform_admin()
// bypassa il filtro center_id nelle RLS, stesso pattern già usato da
// /admin/group-requests). Vedi lib/data/admin-inquiries.ts,
// lib/data/admin-attendance.ts, lib/data/admin-favorites.ts.

test.describe("Admin - Nuovi pannelli cross-centro", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
  });

  // Priorita: Media | Precondizioni: Nessuna (gestisce anche lo stato vuoto)
  test("TC-175 - 'Richieste (SLA)' mostra l'aggregato su tutti i centri o lo stato vuoto", async ({ page }) => {
    await page.goto("/admin/richieste");
    await expect(page.getByRole("heading", { name: "Richieste — SLA per centro" })).toBeVisible();
    await expect(page.getByText("Richieste aperte (piattaforma)")).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Nessuna (gestisce anche lo stato vuoto)
  test("TC-176 - 'Presenze' mostra il confronto tra centri o lo stato vuoto", async ({ page }) => {
    await page.goto("/admin/presenze");
    await expect(page.getByRole("heading", { name: "Presenze — confronto tra centri" })).toBeVisible();
    await expect(page.getByText("Media piattaforma")).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Nessuna (gestisce anche lo stato vuoto)
  test("TC-177 - 'Preferiti' mostra il segnale di domanda o lo stato vuoto", async ({ page }) => {
    await page.goto("/admin/preferiti");
    await expect(page.getByRole("heading", { name: "Preferiti — segnale di domanda" })).toBeVisible();
    await expect(page.getByText("Attività con preferiti")).toBeVisible();
  });
});
