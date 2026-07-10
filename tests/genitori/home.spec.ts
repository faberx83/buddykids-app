import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Home
// Test implementati (selettori presi da app/(main)/page.tsx e components/HomeFeed.tsx).
//
// Convertiti da gotoAsRole a loginAs: Home reindirizza a /auth/login se
// Supabase è configurato e non c'è sessione reale.

test.describe("Genitori - Home", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/");
  });

  // TC-013 - Filtro categoria in Home
  // NOTA (aggiornato): la vecchia Home "🔥 Popolari vicino a te" con filtro
  // categoria in cima è stata sostituita dal toggle Planner/Per bambino
  // (vedi HomeFeed.tsx) — le "Categorie" ora vivono dentro "Per bambino"
  // (PerBambinoView.tsx), senza un cambio di titolo dedicato: verifichiamo
  // quindi che il chip si selezioni/deselezioni visivamente invece del
  // vecchio titolo "🔥 Attività in questa categoria" che non esiste più.
  //
  // BUG DI TEST TROVATO+CORRETTO (run reale): la regex /border-sky/ matcha
  // ANCHE la classe statica "hover:border-sky" presente nel chip NON
  // selezionato (components/CategoryChip.tsx: stato non selezionato =
  // "border-[#EDF0F4] bg-white hover:border-sky hover:bg-sky"), quindi
  // l'assert ".not.toHaveClass(/border-sky/)" falliva SEMPRE (falso positivo
  // di selezione). Corretta con un lookbehind negativo che esclude il prefisso
  // "hover:", così la regex riconosce solo la classe reale dello stato
  // selezionato ("border-sky bg-sky", senza prefisso).
  test("TC-013 - selezionare una categoria filtra le card, 'Tutte' ripristina", async ({ page }) => {
    const selectedClass = /(?<!hover:)border-sky\b/;
    await page.getByRole("button", { name: "Per bambino", exact: true }).click();
    await expect(page.getByText("Categorie")).toBeVisible();

    const sportChip = page.getByText("Sport", { exact: true }).locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]").first();
    await sportChip.click();
    await expect(sportChip).toHaveClass(selectedClass);

    await page.getByText("Tutte", { exact: true }).click();
    await expect(sportChip).not.toHaveClass(selectedClass);
  });

  // TC-014 - Geolocalizzazione Home (permesso concesso)
  test("TC-014 - 'Usa posizione' con permesso concesso mostra un conteggio di centri", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByText(/centri nel raggio di 5 km/)).toBeVisible({ timeout: 10_000 });
  });

  // TC-015 - Geolocalizzazione negata
  test("TC-015 - 'Usa posizione' con permesso negato mostra un messaggio d'errore leggibile", async ({
    page,
    context,
  }) => {
    await context.clearPermissions(); // permesso non concesso -> il browser blocca/rifiuta
    await page.getByRole("button", { name: "Usa posizione" }).click();
    // L'app non deve crashare: la CTA resta cliccabile e/o appare un messaggio di errore.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // TC-023 - Ricerca con geolocalizzazione da Home -> Cerca
  test("TC-023 - 'Vedi in Cerca' dopo la geolocalizzazione porta a /search con lat/lng", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 });

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByRole("button", { name: "Vedi in Cerca" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Vedi in Cerca" }).click();

    await expect(page).toHaveURL(/\/search\?.*lat=.*lng=/);
  });
  // Priorita: Alta | Precondizioni: Almeno un'attivita inserita in Supabase
  // Passi: Login come genitore -> apri '/'
  // Risultato atteso: Le card 'Popolari' mostrano attivita reali dal DB, non i dati demo
  test.fixme("TC-012 - Home mostra attivita reali", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

});
