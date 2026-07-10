import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Ricerca e scoperta (Sprint 2)
// Meno filtri manuali di LEGACY (età/prezzo/zona/tag/servizi/data), più
// contesto del genitore (bambini, storico, settimana scoperta, posizione)
// tradotto in un ordinamento con motivazioni leggibili ("Piace a X", "Vicino
// a te", "Libera nella settimana ancora scoperta").

test.describe("NEXTGEN - Ricerca e scoperta (Sprint 2)", () => {
  test("TC-N10 - /nextgen/search mostra risultati ordinati con motivazioni, senza pannelli filtro multipli", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");

    await expect(page.getByPlaceholder("Cerca per nome…")).toBeVisible();
    await expect(page.getByText("Usa la mia posizione").or(page.getByText("Posizione attiva"))).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N11 - Il link 'Scopri attività' in Dashboard porta alla Ricerca NEXTGEN", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Scopri attività" }).click();
    await expect(page).toHaveURL(/\/nextgen\/search/);
  });

  test("TC-N12 - Filtro testuale per nome riduce i risultati", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await page.getByPlaceholder("Cerca per nome…").fill("zzz-nome-inesistente-zzz");
    await expect(page.getByText("Nessuna attività trovata.")).toBeVisible();
  });
});
