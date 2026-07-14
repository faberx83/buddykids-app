import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Community (Sprint 4)
// "Esperienze condivise": comunità persistente e multi-attività fra famiglie
// (creazione/adesione tramite codice, proposte di attività, interesse/voto,
// generazione di un Gruppo sconto vero e proprio da una proposta matura).
// Distinta dai "Gruppi" esistenti (tests/genitori/gruppi.spec.ts se presente),
// che restano legati a UNA sola attività.

test.describe("NEXTGEN - Community (Sprint 4)", () => {
  // REBRAND TRAMA Sprint 1: NextgenBottomNav è passata a 5 voci
  // (Home/Planner/Scopri/Prenotazioni/Profilo, vedi NextgenBottomNav.tsx) e
  // "Community" ne è uscita — resta raggiungibile da Planner → scheda
  // "Gruppi" (PlannerGroupsView.tsx, link "Vedi tutte"/"Crea o entra" verso
  // /nextgen/community), percorso aggiornato di conseguenza.
  test("TC-N32 - Da Planner-Gruppi si raggiunge /nextgen/community", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await page.getByRole("button", { name: "Gruppi" }).click();
    await page.getByRole("link", { name: /Vedi tutte|Crea o entra/ }).click();
    await expect(page).toHaveURL(/\/nextgen\/community$/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N33 - Creare una community mostra subito il codice invito nel dettaglio", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/community");

    await page.getByRole("button", { name: "Crea community" }).click();
    const uniqueName = `Community di test ${Date.now()}`;
    await page.getByPlaceholder(/Nome/).fill(uniqueName);
    await page.getByRole("button", { name: "Crea" }).click();

    await expect(page).toHaveURL(/\/nextgen\/community\/[a-f0-9-]+/);
    await expect(page.getByText("Codice invito")).toBeVisible();
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("TC-N34 - Un codice invito non valido mostra un errore leggibile", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/community");

    await page.getByRole("button", { name: "Entra con codice" }).click();
    await page.getByPlaceholder(/Es\./).fill("ZZZZZZ");
    await page.getByRole("button", { name: "Entra" }).click();

    await expect(page.getByText(/Codice non valido/)).toBeVisible();
  });

  test("TC-N35 - Proporre un'attività la mostra in 'Le attività della community'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test, con una community già creata e almeno un'attività a catalogo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/community");
    await page.locator("a[href^='/nextgen/community/']").first().click();

    await page.getByRole("button", { name: "Proponi" }).click();
    await page.locator("select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Condividi proposta" }).click();

    await expect(page.getByText("Le attività della community")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mi interessa/ })).toBeVisible();
  });

  test("TC-N36 - Esprimere interesse aggiorna il contatore e lo stato del pulsante", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato, una community con almeno una proposta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/community");
    await page.locator("a[href^='/nextgen/community/']").first().click();

    const interestButton = page.getByRole("button", { name: /Mi interessa|Interessato/ }).first();
    await interestButton.click();
    await expect(page.getByRole("button", { name: "Interessato · 1" })).toBeVisible();
  });

  // ESCLUSO dall'automazione: verificare "N famiglie già iscritte" richiede
  // due account di test con una prenotazione reale sulla stessa attività —
  // vedi tests/README.md per i dati di seed necessari.
  test.fixme("TC-N37 - 'Famiglie già iscritte' riflette le prenotazioni reali dei membri", async () => {});

  // ESCLUSO dall'automazione: "Genera Gruppo" richiede un ruolo Creatore/Admin
  // + una proposta con almeno un interesse, entrambi da seedare manualmente.
  test.fixme("TC-N38 - 'Genera Gruppo' (solo Creatore/Admin) crea un gruppo collegato alla community", async () => {});

  test("TC-N39 - Il segnale sociale in Home compare solo se c'è una proposta con interesse attivo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e una community con una proposta con almeno un interesse.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText(/stanno valutando/)).toBeVisible();
  });

  // Sprint restyle NEXTGEN — Poppins sui titoli + CTA primari migrati da
  // bg-ink (vecchio, pre-rebrand) a bg-trama-violet, stessa palette del
  // resto del rebrand TRAMA (Home, Planner). Community era la pagina più
  // indietro (nessun font-poppins, CTA ancora bg-ink).
  test("TC-N90 - I CTA primari di Community usano il colore del brand (trama-violet, non piu' bg-ink)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/community");

    const createButton = page.getByRole("button", { name: "Crea community" });
    await expect(createButton).toHaveClass(/bg-trama-violet/);
    await expect(createButton).not.toHaveClass(/bg-ink\b/);
  });
});
