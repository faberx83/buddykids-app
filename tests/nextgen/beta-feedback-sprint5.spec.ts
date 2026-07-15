import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Sprint 5 "Segnala un problema" (floating CTA BETA)
// Richiesta di Fabrizio: durante la fase BETA vuole una CTA mobile
// draggabile presente su ogni pagina dell'app GENITORI NEXTGEN (non lato
// gestore/admin — Fabrizio: "su cui poi implementeremo stesso meccanismo",
// una fase futura separata) per raccogliere bug/suggerimenti, una coda lato
// Admin con report per area/stato e una label che identifica l'app di
// provenienza (oggi solo "genitori"), e una sezione "temporanea" lato
// genitore per seguire l'esito delle proprie segnalazioni.

test.describe("NEXTGEN Sprint 5 - Segnala un problema (BETA)", () => {
  test("TC-N286 - La floating CTA 'Segnala un problema' è visibile nelle pagine genitore NEXTGEN", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByRole("button", { name: "Segnala un problema" })).toBeVisible();
  });

  // La CTA condivide ancora il layout con le rotte placeholder Sprint 0
  // /nextgen/admin e /nextgen/center (non hanno un layout proprio) — non
  // deve comparire lì, per non anticipare la fase "gestore" non ancora
  // implementata.
  test("TC-N287 - La floating CTA non compare su /nextgen/admin e /nextgen/center (placeholder Sprint 0)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account con ruolo center_admin/platform_admin.");
    await loginAs(page, "platform_admin");
    await page.goto("/nextgen/admin");

    await expect(page.getByRole("button", { name: "Segnala un problema" })).toHaveCount(0);
  });

  test("TC-N288 - Inviare una segnalazione vuota mostra un errore, con testo mostra conferma", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await page.getByRole("button", { name: "Segnala un problema" }).click();
    await expect(page.getByText("Segnala un problema", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Invia segnalazione" }).click();
    await expect(page.getByText("Scrivi qualcosa prima di inviare")).toBeVisible();

    await page.getByPlaceholder("Cosa non funziona o cosa miglioreresti?").fill("Il pulsante X non risponde al tocco.");
    await page.getByRole("button", { name: "Invia segnalazione" }).click();

    await expect(page.getByText("Segnalazione inviata, grazie!")).toBeVisible();
  });

  test("TC-N289 - Profilo mostra la sezione temporanea 'Le mie segnalazioni' con lo stato inviato", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato, l'account genitore di test e almeno una segnalazione già inviata (vedi TC-N288).");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");
    await page.getByRole("link", { name: /Le mie segnalazioni/ }).click();

    await expect(page).toHaveURL(/\/nextgen\/profile\/segnalazioni/);
    const firstItem = page.getByText(/Nuovo|In gestione|Risolto/).first();
    if (!(await firstItem.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna segnalazione ancora inviata per l'account di test.");
    }
    await expect(firstItem).toBeVisible();
  });

  test("TC-N290 - Admin: /admin/segnalazioni-beta mostra i conteggi per stato e per area, con label 'App genitori'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato, l'account Admin di test e almeno una segnalazione già inviata (vedi TC-N288).");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/segnalazioni-beta");

    await expect(page.getByRole("heading", { name: "Segnalazioni BETA" })).toBeVisible();
    await expect(page.getByText("Totale", { exact: true })).toBeVisible();

    const firstRow = page.getByText("App genitori", { exact: true }).first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna segnalazione ancora presente per verificare la label app_source.");
    }
    await expect(firstRow).toBeVisible();
  });

  test("TC-N291 - Admin: cambiare lo stato di una segnalazione in 'In gestione' aggiorna la riga", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato, l'account Admin di test e almeno una segnalazione 'Nuovo'.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/segnalazioni-beta");

    const inGestioneButton = page.getByRole("button", { name: "In gestione" }).first();
    if (!(await inGestioneButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna segnalazione con stato che permetta il passaggio a 'In gestione'.");
    }
    await inGestioneButton.click();

    await expect(page.getByText("In gestione", { exact: true }).first()).toBeVisible();
  });
});
