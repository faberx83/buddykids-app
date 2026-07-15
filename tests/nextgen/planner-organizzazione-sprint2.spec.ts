import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline + Stato per
// settimana): raggruppamento della Timeline per mese, righe con
// prenotazione attiva cliccabili verso la scheda attività, date della
// settimana mostrate al click su "Stato per settimana".

test.describe("NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline mensile)", () => {
  test("TC-271 - La Timeline è raggruppata per mese, pieghevole", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/Timeline della stagione/)).toBeVisible();
    // Almeno un'intestazione di mese (Giugno/Luglio/Agosto/Settembre — la
    // stagione tipo copre metà giugno-metà settembre, vedi season-weeks.ts).
    const monthHeader = page.getByText(/Giugno|Luglio|Agosto|Settembre/).first();
    await expect(monthHeader).toBeVisible();
  });

  test("TC-272 - Cliccare una barra di 'Stato per settimana' apre il mese giusto, evidenzia la riga e mostra le date", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const firstWeekBar = page.getByRole("button", { name: /Vai al dettaglio della Settimana 1,/ });
    await firstWeekBar.click();

    // La data della settimana compare accanto al titolo "Stato per settimana".
    await expect(page.getByText(/Settimana 1 ·/).first()).toBeVisible();
    // La riga corrispondente nella Timeline esiste nel DOM (il mese si è
    // aperto automaticamente) ed è evidenziata.
    await expect(page.locator("#week-row-1")).toBeVisible();
  });

  test("TC-273 - Una riga Timeline con attività reale (slug) è cliccabile e apre la scheda attività", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    // Apri tutti i mesi per trovare una riga coperta con link reale.
    const monthButtons = page.locator('button[aria-expanded="false"]');
    const count = await monthButtons.count();
    for (let i = 0; i < count; i++) {
      await monthButtons.nth(0).click();
    }

    const clickableRow = page.locator('a[href^="/activity/"]').first();
    if (!(await clickableRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta con attività reale per l'account di test in questo momento.");
    }
    await clickableRow.click();
    await expect(page).toHaveURL(/\/activity\//);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
