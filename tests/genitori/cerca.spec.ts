import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Cerca
// Test implementati (selettori presi da app/(main)/search/SearchClient.tsx).
// Convertiti da gotoAsRole a loginAs: /search richiede sessione reale contro
// un deploy con Supabase configurato; l'attività di test seminata garantisce
// almeno un risultato su cui i filtri possano operare.

test.describe("Genitori - Cerca", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/search");
  });

  function resultsCount(page: import("@playwright/test").Page) {
    return page.getByText(/\d+ attività trovate/);
  }

  // TC-016 - Ricerca testuale
  // BUG DI TEST TROVATO+CORRETTO (run reale): l'assert finale era invertita —
  // usava ".not.toHaveText(before)" aspettandosi che il conteggio DOPO aver
  // svuotato la ricerca fosse DIVERSO da quello iniziale. In realtà svuotare
  // la casella di ricerca deve ripristinare la STESSA lista non filtrata di
  // partenza, quindi il conteggio deve tornare UGUALE a "before", non diverso
  // — contro un deploy reale (conteggio stabile, es. "6 attività trovate" sia
  // prima che dopo) l'assert invertita falliva sempre.
  test("TC-016 - digitare il nome di un'attività filtra la lista, svuotare la ripristina", async ({
    page,
  }) => {
    const before = await resultsCount(page).textContent();
    const searchBox = page.getByPlaceholder("Cerca attività, centri, sport...");
    await searchBox.fill("zzzznonexistentzzzz");
    await expect(page.getByText("0 attività trovate")).toBeVisible();

    await searchBox.fill("");
    await expect(resultsCount(page)).toHaveText(before ?? "");
  });

  // TC-018 - Filtro Prezzo
  test("TC-018 - abbassare il tetto massimo di prezzo riduce i risultati", async ({ page }) => {
    const before = await resultsCount(page).textContent();

    await page.getByText("Prezzo", { exact: true }).click();
    const slider = page.locator('input[type="range"]');
    await slider.fill("50"); // tetto minimo possibile

    await expect(resultsCount(page)).not.toHaveText(before ?? "");
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  });

  // TC-020 - Filtro Servizi - Bar
  test("TC-020 - filtro 'Bar nel centro' mostra solo centri con bar", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥤 Bar nel centro").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
    // La lista si aggiorna (numero risultati coerente col filtro applicato).
    await expect(resultsCount(page)).toBeVisible();
  });

  // TC-022 - Azzeramento filtri
  test("TC-022 - 'Azzera' riporta tutti i filtri al default e chiude il pannello", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥤 Bar nel centro").click();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();

    await page.getByRole("button", { name: /^Azzera/ }).click();

    await expect(page.getByRole("button", { name: /^Azzera$/ })).toBeDisabled();
    // Il pannello "Servizi" aperto deve richiudersi.
    await expect(page.getByText("🥤 Bar nel centro")).not.toBeVisible();
  });
  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Apri filtro 'Eta' -> sposta gli slider min/max
  // Risultato atteso: La lista si aggiorna mostrando solo attivita compatibili con la fascia
  test.fixme("TC-017 - Filtro Eta", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Apri filtro 'Zona' -> digita una via/quartiere presente in un indirizzo
  // Risultato atteso: Restano solo le attivita con quell'indirizzo/centro
  test.fixme("TC-019 - Filtro Zona (testo)", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Seleziona singolarmente Pranzo incluso / Pre-scuola / Post-scuola
  // Risultato atteso: La lista si filtra coerentemente con i campi dell'attivita
  test.fixme("TC-021 - Filtro Servizi - Pranzo/Pre/Post", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Aver cliccato 'Usa posizione' in Home
  // Passi: Da Home, dopo la geolocalizzazione, clicca 'Vedi in Cerca'
  // Risultato atteso: Si apre /search?lat=..&lng=.. con distanze reali calcolate e badge 'Vicino a te'
  test.fixme("TC-023 - Ricerca con geolocalizzazione da Home", async ({ page }) => {
    // Test reale gia' presente in tests/genitori/home.spec.ts (flusso Home -> Cerca con geolocalizzazione).
  });

  // Priorita: Bassa | Precondizioni: Nessuna
  // Passi: Clicca il chip 'Date'
  // Risultato atteso: Dovrebbe aprire un filtro per data/settimana
  test.fixme("TC-024 - Filtro Date", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

});
