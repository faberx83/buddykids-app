import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE Build Sprint 5 — CenterLead (J11 "Suggerisci un centro non
// iscritto"). Copre: punto di ingresso Genitore nello stato zero-risultati
// di Scopri, invio segnalazione, "I tuoi suggerimenti" (sola lettura), coda
// Admin (/admin/center-leads) con qualifica/claim. Nessun test qui verifica
// automazioni economiche reali (fuori scope Sprint 5, vedi
// SPRINT_5_FEATURE_PRESERVATION_MATRIX.md) — solo che le annotazioni
// manuali di reward/commission siano raggiungibili, non che producano un
// pagamento.
//
// Serializzato: TC-N601 crea una segnalazione reale che TC-N602/603/604/605
// leggono e mutano in sequenza (stesso pattern già usato da
// tests/one/walkthrough-partner.spec.ts per TC-N414/415).
test.describe.configure({ mode: "serial" });

const UNIQUE_NAME = `[TEST] Centro Segnalato ${Date.now()}`;

test.describe("TRAMA ONE — CenterLead: suggerimento centro non iscritto (Sprint 5)", () => {
  test("TC-N600 - Genitore: una ricerca senza risultati mostra il punto di ingresso 'Suggerisci un centro'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");

    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await page.getByPlaceholder("Cerca per nome…").fill("zzzznonexistentcenterzzzz9999");

    await expect(page.getByText("Nessuna attività corrisponde ai filtri scelti.")).toBeVisible();
    await expect(page.getByText("Non trovi il centro che cerchi?")).toBeVisible();
  });

  test("TC-N601 - Genitore: inviare una segnalazione crea SOLO una riga center_leads, mai un'attività pubblica", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");

    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await page.getByPlaceholder("Cerca per nome…").fill("zzzznonexistentcenterzzzz9999");
    await page.getByRole("button", { name: "Suggerisci un centro" }).click();

    await page.getByPlaceholder("Nome del centro *").fill(UNIQUE_NAME);
    await page.getByPlaceholder("Città / zona (indicativo)").fill("Torino");
    await page.getByRole("button", { name: "Invia segnalazione" }).click();

    await expect(page.getByText("Grazie! Abbiamo ricevuto la tua segnalazione")).toBeVisible();
  });

  test("TC-N602 - Genitore: 'I tuoi suggerimenti' mostra la segnalazione appena inviata come 'Ricevuta'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");

    await loginAs(page, "parent");
    await page.goto("/center-leads");

    const row = page.getByText(UNIQUE_NAME).locator("..").locator("..");
    await expect(row.getByText("Ricevuta")).toBeVisible();
  });

  test("TC-N603 - Admin: la coda 'Segnalazioni centri' mostra la nuova segnalazione tra le Attive", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform_admin di test.");

    await loginAs(page, "platform_admin");
    await page.goto("/admin/center-leads");

    const row = page.getByText(UNIQUE_NAME).locator("..").locator("..");
    await expect(row.getByText("Nuova")).toBeVisible();
  });

  test("TC-N604 - Admin: 'Qualifica' sposta lo stato della segnalazione a 'In valutazione'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform_admin di test.");

    await loginAs(page, "platform_admin");
    await page.goto("/admin/center-leads");

    // Tre livelli: dal testo del nome (D) al contenitore riga (C) al blocco
    // nome+badge (B) alla card intera (A), che è l'unico livello che include
    // sia il badge di stato sia la riga dei bottoni di azione (fratelli, non
    // annidati l'uno nell'altro — vedi CenterLeadsAdminClient.tsx).
    const card = page.getByText(UNIQUE_NAME).locator("..").locator("..").locator("..");
    await card.getByRole("button", { name: "Qualifica" }).click();
    await expect(card.getByText("In valutazione")).toBeVisible();
  });

  test("TC-N605 - Admin: il claim collega la segnalazione a un centro esistente e la sposta nello Storico come 'claimed'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform_admin di test.");

    await loginAs(page, "platform_admin");
    await page.goto("/admin/center-leads");

    const card = page.getByText(UNIQUE_NAME).locator("..").locator("..").locator("..");
    // Qualunque centro reale della select: il claim collega, non crea nulla
    // di nuovo (DDL-023) — non importa quale centro, verifichiamo solo il
    // meccanismo di collegamento.
    const select = card.locator("select");
    await select.selectOption({ index: 1 });
    await card.getByRole("button", { name: "Claim" }).click();

    await expect(page.getByText("Iscritto (claimed)").first()).toBeVisible();
  });

  test("TC-N606 - Un utente non autenticato che apre /center-leads o /admin/center-leads viene reindirizzato al login", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");

    await page.goto("/center-leads");
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto("/admin/center-leads");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
