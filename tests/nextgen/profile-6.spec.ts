import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Profilo (Sprint 6, ultimo dei 6 sprint "punch list" di
// Fabrizio: consolidamento Indirizzi/Famiglia/Prenotazioni, tab-scroll
// Planner, Organizzazione+Calendario, Mappa, filtri Scopri, e infine il
// redesign di Profilo). Prima /profile era rimasto 100% LEGACY (header
// gradiente, MenuItem con bordo, nessun PageHeader/icona brand) mentre il
// resto di NEXTGEN era già stato ridisegnato — vedi
// app/nextgen/profile/ProfileNextgenClient.tsx. Riusa dati e logica di
// sempre (ProfileHeaderClient/ProfileKidsSection, accent="violet" opt-in),
// cambia solo il contenitore visivo. Selettori presi da quel file.

test.describe("NEXTGEN - Profilo (Sprint 6)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");
  });

  test("TC-N105 - /nextgen/profile ha PageHeader con icona brand colorata e titolo 'Profilo'", async ({ page }) => {
    await expect(page.getByText("Profilo", { exact: true })).toBeVisible();
    await expect(page.locator('img[src="/brand/trama-logo-mark.png"]')).toBeVisible();
  });

  test("TC-N106 - la bottom nav NEXTGEN porta 'Profilo' a /nextgen/profile (non più /profile LEGACY)", async ({
    page,
  }) => {
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Profilo" }).click();
    await expect(page).toHaveURL(/\/nextgen\/profile/);
  });

  test("TC-N107 - la card 'Condivisione piano' porta al Calendario del Planner (?mode=calendario)", async ({
    page,
  }) => {
    const card = page.getByRole("link", { name: /Condivisione piano/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/nextgen/planner?mode=calendario");
  });

  test("TC-N108 - le card di accesso rapido (Prenotazioni/Preferiti/Presenze/Richieste) sono presenti con i link corretti", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: /Le mie prenotazioni/ })).toHaveAttribute("href", "/prenotazioni");
    await expect(page.getByRole("link", { name: /^Preferiti/ })).toHaveAttribute("href", "/preferiti");
    await expect(page.getByRole("link", { name: /Le presenze/ })).toHaveAttribute("href", "/presenze");
    await expect(page.getByRole("link", { name: /Le mie richieste/ })).toHaveAttribute("href", "/richieste");
  });
});
