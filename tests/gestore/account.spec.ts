import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Il mio account
// Generato da BuddyKids_Test_Case.xlsx - profilo PERSONALE del gestore,
// distinto da /center/profile (profilo del CENTRO — business, vedi
// tests/gestore/profilo-centro.spec.ts). Nuova funzionalità: prima di questa
// pagina il gestore non aveva alcuna sezione di dati personali/sicurezza.

test.describe("Gestore - Il mio account", () => {
  // TC-138 - Pagina profilo personale distinta dal profilo del centro
  test("TC-138 - '/center/account' mostra dati personali/sicurezza/preferenze/privacy del gestore", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/account");

    // Non è il profilo del centro: niente campo "Nome del centro" o heading "Il mio centro".
    await expect(page.getByText("Il mio centro")).toHaveCount(0);
    await expect(page.getByText("Nome del centro")).toHaveCount(0);

    // Sezioni del profilo personale, condivise con il profilo genitore.
    await expect(page.getByRole("button", { name: "Modifica" })).toBeVisible();
    await expect(page.getByText("Sicurezza", { exact: true })).toBeVisible();
    await expect(page.getByText("Preferenze", { exact: true })).toBeVisible();
    await expect(page.getByText("Privacy e account", { exact: true })).toBeVisible();
    await expect(page.locator("#security-new-password")).toBeVisible();

    // Il selettore "Sei: Padre/Madre/Tutore" non ha senso per un gestore.
    await expect(page.getByRole("button", { name: "Madre" })).toHaveCount(0);
  });
});
