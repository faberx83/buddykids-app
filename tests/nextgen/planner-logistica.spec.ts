import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - ex hub "Logistica & Famiglia" (Sprint 7)
// L'hub /nextgen/planner/logistica (introdotto nello sprint correttivo per
// consolidare Indirizzi/Famiglia/Condivisione piano/Prenotazioni in un unico
// link dal Planner) è stato eliminato — feedback di Fabrizio: "Logistica e
// Famiglia non devono diventare una sezione ad hoc?". Indirizzi/Famiglia/
// Condivisione piano sono ora vere sezioni dentro Profilo (vedi
// tests/nextgen/profile-6.spec.ts e ProfileNextgenClient.tsx). Questo file
// verifica solo che la vecchia rotta non sia un vicolo cieco (redirect,
// non 404) e che il vecchio link non compaia più nel Planner.

test.describe("NEXTGEN - ex hub Logistica & Famiglia (rimosso, Sprint 7)", () => {
  test("TC-N110 - Il Planner non mostra più il link 'Logistica & Famiglia'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByRole("link", { name: /Logistica & Famiglia/ })).toHaveCount(0);
  });

  // SPRINT 4 correttivo (audit link) — il redirect puntava ancora a
  // /nextgen/profile da quando "Famiglia" viveva in prima pagina; dopo la
  // consolidazione (task #236) che l'ha nascosta dietro l'hub card "Famiglia
  // e logistica", il vecchio bookmark si fermava un click prima della
  // destinazione reale. L'assertion ora richiede l'URL ESATTO dell'hub
  // (prima una regex larga /\/nextgen\/profile/ avrebbe ugualmente
  // "passato" anche il redirect corto, senza proteggere dalla regressione).
  test("TC-N111 - /nextgen/planner/logistica reindirizza a /nextgen/profile/famiglia (non un vicolo cieco, non un hop corto)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/logistica");

    await expect(page).toHaveURL(/\/nextgen\/profile\/famiglia$/);
  });
});
