import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { areaLabelFromPath } from "../../lib/nextgen/beta-feedback-areas";

// TRAMA ONE — Chiusura rimandi legacy dentro NEXTGEN (24/08/2026, task #528).
// Analisi richiesta da Fabrizio ("nel profilo, sotto impostazioni, ci sono
// ancora rimandi al legacy... voglio che tu faccia una analisi approfondita
// di tutti i rimandi ancora presenti... eliminando (non definitivamente) i
// riferimenti"): 8 href individuati da un audit Grep su app/nextgen/** e
// components/nextgen/**, ciascuno ora ha un guscio NEXTGEN-native dedicato
// (stesso pattern già validato per "Le mie prenotazioni", task #524) che
// riusa la STESSA query/logica delle pagine LEGACY sottostanti — nessuna
// rotta LEGACY è stata toccata o rimossa, restano intatte per chi è ancora
// su LEGACY.
async function expectNextgenChrome(page: import("@playwright/test").Page) {
  // Bottom nav NEXTGEN (5 voci) presente — prova che il layout è quello di
  // app/nextgen/layout.tsx, non app/(main)/layout.tsx (LEGACY, BottomNav
  // diverso, vedi components/BottomNav.tsx).
  await expect(page.locator('a[href="/nextgen/planner"]')).toBeVisible();
  await expect(page.locator('a[href="/nextgen/prenotazioni"]')).toBeVisible();
  // Logo TRAMA accanto al titolo (PageHeader#showBrandIcon=true).
  await expect(page.locator('img[src="/brand/trama-logo-mark.png"][aria-hidden="true"]')).toBeVisible();
}

test.describe("TRAMA ONE — guscio NEXTGEN-native per pagine prima solo LEGACY", () => {
  test("TC-N645 - /nextgen/preferiti mostra il guscio NEXTGEN e la lista preferiti reale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/preferiti");
    await expect(page.getByText("Preferiti", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N646 - /nextgen/presenze mostra il guscio NEXTGEN e il report presenze reale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/presenze");
    await expect(page.getByText("Le presenze", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N647 - /nextgen/richieste mostra il guscio NEXTGEN e le richieste reali", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/richieste");
    await expect(page.getByText("Le mie richieste", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N648 - /nextgen/center-leads mostra il guscio NEXTGEN e i suggerimenti reali", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/center-leads");
    await expect(page.getByText("I tuoi suggerimenti", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N649 - /nextgen/profile/impostazioni/sicurezza mostra il guscio NEXTGEN", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/sicurezza");
    await expect(page.getByText("Sicurezza", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N650 - /nextgen/profile/impostazioni/preferenze mostra il guscio NEXTGEN", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/preferenze");
    await expect(page.getByText("Preferenze", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N651 - /nextgen/profile/impostazioni/privacy mostra il guscio NEXTGEN", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/privacy");
    await expect(page.getByText("Privacy e account", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
  });

  test("TC-N652 - /nextgen/groups mostra il guscio NEXTGEN, non più il layout LEGACY (caso più grave dell'audit: '/groups' è una voce primaria del BottomNav LEGACY)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/groups");
    await expect(page.getByText("Gruppi & Community", { exact: true })).toBeVisible();
    await expectNextgenChrome(page);
    // Back-arrow verso il Planner (basePath/backHref passati dal guscio
    // NEXTGEN, vedi app/nextgen/groups/page.tsx) — assente in LEGACY, dove
    // /groups è una tab di primo livello senza "indietro".
    await page.getByRole("button", { name: "Indietro" }).click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
  });

  test("TC-N653 - creare un gruppo da /nextgen/groups resta dentro NEXTGEN (basePath), il link 'Gruppi' nel dettaglio riporta a /nextgen/groups (non /groups LEGACY)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/groups");
    await page.getByRole("button", { name: "+ Nuovo" }).click();
    await page.getByPlaceholder("Nome del gruppo").fill("[TEST] Gruppo NEXTGEN-native");
    await page.getByRole("button", { name: "Crea gruppo" }).click();
    await expect(page).toHaveURL(/\/nextgen\/groups\/[0-9a-f-]+/);
    const backLink = page.locator('a', { hasText: "Gruppi" }).first();
    await expect(backLink).toHaveAttribute("href", "/nextgen/groups");
  });
});

test.describe("TRAMA ONE — link Profilo/Impostazioni/Planner NEXTGEN non rimandano più al LEGACY", () => {
  test("TC-N654 - dal Profilo NEXTGEN, 'Preferiti'/'Le presenze'/'I tuoi suggerimenti'/'Le mie richieste' portano tutti a rotte /nextgen/*", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");
    await expect(page.locator('a[href="/nextgen/preferiti"]')).toBeVisible();
    await expect(page.locator('a[href="/nextgen/presenze"]')).toBeVisible();
    await expect(page.locator('a[href="/nextgen/center-leads"]')).toBeVisible();
    await expect(page.locator('a[href="/nextgen/richieste"]')).toBeVisible();
  });

  test("TC-N655 - da Impostazioni NEXTGEN, 'Sicurezza'/'Preferenze'/'Privacy e account' portano tutti a rotte /nextgen/profile/impostazioni/*", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni");
    await expect(page.locator('a[href="/nextgen/profile/impostazioni/sicurezza"]')).toBeVisible();
    await expect(page.locator('a[href="/nextgen/profile/impostazioni/preferenze"]')).toBeVisible();
    await expect(page.locator('a[href="/nextgen/profile/impostazioni/privacy"]')).toBeVisible();
  });

  test("TC-N656 - dal Planner NEXTGEN (scheda Gruppi), 'I tuoi Gruppi sconto' porta a /nextgen/groups", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: /Gruppi/ }).click();
    await expect(page.locator('a[href="/nextgen/groups"]')).toBeVisible();
  });
});

// Verifica "no browser" delle etichette segnalazioni beta per le nuove
// rotte: gira sempre, anche in questo sandbox senza browser reale.
test.describe("TRAMA ONE — beta-feedback area label per le nuove rotte NEXTGEN-native [no browser]", () => {
  test("TC-N657 - areaLabelFromPath riconosce tutte le nuove rotte /nextgen/* introdotte dal task #528", () => {
    expect(areaLabelFromPath("/nextgen/preferiti")).toBe("Preferiti");
    expect(areaLabelFromPath("/nextgen/presenze")).toBe("Presenze");
    expect(areaLabelFromPath("/nextgen/richieste")).toBe("Le mie richieste");
    expect(areaLabelFromPath("/nextgen/center-leads")).toBe("I tuoi suggerimenti");
    expect(areaLabelFromPath("/nextgen/groups")).toBe("Gruppi");
    expect(areaLabelFromPath("/nextgen/groups/abc-123")).toBe("Gruppi");
    expect(areaLabelFromPath("/nextgen/profile/impostazioni/sicurezza")).toBe("Profilo · Impostazioni");
    expect(areaLabelFromPath("/nextgen/profile/impostazioni/preferenze")).toBe("Profilo · Impostazioni");
    expect(areaLabelFromPath("/nextgen/profile/impostazioni/privacy")).toBe("Profilo · Impostazioni");
  });
});
