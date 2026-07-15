import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner, Organizzazione semplificata (Sprint correttivo)
// Feedback di Fabrizio (mockup "2. Calendario"): "vorrei semplificare le
// notifiche, sono troppe" + "anche Planner-Calendario finirebbero a
// collassare nella stessa sezione" + "ogni barra del bambino o lo stato per
// settimana deve portare ad un dettaglio del piano". Vedi PlannerClient.tsx
// per il dettaglio completo di ciascuna modifica.

test.describe("NEXTGEN - Planner, Organizzazione semplificata", () => {
  test("TC-N97 - Promemoria/Missioni mostrano un solo avviso di default, con 'Mostra tutti' per il resto", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno 2 avvisi (promemoria+missioni) attivi.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const showAllButton = page.getByRole("button", { name: /Mostra tutti \(\d+\)/ });
    if (!(await showAllButton.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha 0 o 1 solo avviso attivo: nulla da espandere.");
    }
    const countMatch = (await showAllButton.textContent())!.match(/\((\d+)\)/);
    const total = countMatch ? Number(countMatch[1]) : 0;

    await showAllButton.click();
    await expect(page.getByRole("button", { name: "Mostra meno" })).toBeVisible();
    // Torna alla visualizzazione compatta.
    await page.getByRole("button", { name: "Mostra meno" }).click();
    await expect(page.getByRole("button", { name: `Mostra tutti (${total})` })).toBeVisible();
  });

  test("TC-N98 - Cliccare la barra di copertura di un bambino apre/chiude il dettaglio settimana per settimana", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con 2+ bambini.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByText("Copertura per bambino", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha un solo figlio: la card non è mostrata.");
    }
    const kidButton = page.locator('button[aria-expanded="false"]').first();
    await kidButton.click();
    await expect(page.locator('button[aria-expanded="true"]').first()).toBeVisible();

    // Richiudendo, il dettaglio scompare di nuovo (il riquadro Calendario
    // parte anch'esso chiuso di default, quindi nessun aria-expanded=true
    // dovrebbe restare in pagina).
    await page.locator('button[aria-expanded="true"]').first().click();
    await expect(page.locator('button[aria-expanded="true"]')).toHaveCount(0);
  });

  test("TC-N99 - 'Stato per settimana': cliccare una barra evidenzia la riga corrispondente della Timeline", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Stato per settimana")).toBeVisible();
    await page.getByRole("button", { name: "Vai al dettaglio della Settimana 1" }).click();

    const row = page.locator("#week-row-1");
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/ring-trama-violet/);
  });

  // Vedi anche family-planner-5-1.spec.ts#TC-N43 (4 tab, non più 5) e
  // family-planner-5-3.spec.ts (tutti i test "Chi fa cosa?"/Condivisione
  // piano, invariati: cliccano ancora un bottone chiamato "Calendario").
  test("TC-N100 - Il riquadro 'Calendario' dentro Organizzazione si apre e chiude senza cambiare tab", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const toggle = page.getByRole("button", { name: "Calendario", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Mese" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settimana" })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // SPRINT 7 — Segnalazione di Fabrizio: "troppe card di notifica, serve una
  // X per chiuderle". Dismiss locale (solo per la sessione corrente, non
  // persistito — vedi PlannerClient.tsx#dismissedAlertIds).
  test("TC-N297 - La X su una card di avviso la nasconde", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test con almeno un avviso attivo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const dismissButton = page.getByRole("button", { name: "Nascondi questo avviso" }).first();
    if (!(await dismissButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessun avviso attivo per l'account di test.");
    }
    const cardText = await dismissButton
      .locator("xpath=preceding-sibling::*[1]")
      .textContent();
    await dismissButton.click();
    if (cardText) {
      await expect(page.getByText(cardText, { exact: true })).toHaveCount(0);
    }
  });

  // SPRINT 7 — Segnalazione di Fabrizio: "i due promemoria di doppia
  // prenotazione non sono azionabili nonostante lo sembrino" — portavano a
  // "scorri e evidenzia la riga della Timeline", un vicolo cieco (quella
  // riga è solo un link alla scheda attività, non permette di annullare
  // nulla). Ora l'azione porta a "Le mie prenotazioni", dove si può davvero
  // annullare/modificare una delle due prenotazioni in conflitto — sia dal
  // promemoria in cima sia dal box "Sovrapposizioni da controllare".
  test("TC-N298 - Il box 'Sovrapposizioni da controllare' porta a 'Le mie prenotazioni'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una sovrapposizione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByText("Sovrapposizioni da controllare", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna sovrapposizione attiva per l'account di test.");
    }
    const link = page.getByRole("link", { name: "Gestisci in Le mie prenotazioni" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/prenotazioni");
  });
});
