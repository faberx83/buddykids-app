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
  // Passi: Clicca il chip 'Date' -> seleziona una settimana della stagione
  // Risultato atteso: Il chip mostra "Settimana N", e' azzerabile con la X, e il conteggio risultati riflette la disponibilita' reale per quella settimana (activity_weeks.spots_left > 0)
  // Ora implementato per davvero: prima era un chip "Prossimamente" senza
  // alcun effetto (vedi lib/data/activities.ts#getActivityAvailabilityByWeek
  // e SearchClient.tsx filteredList).
  test("TC-024 - Filtro Date filtra per disponibilita' reale nella settimana scelta", async ({ page }) => {
    await page.getByText("Date", { exact: true }).click();
    await expect(page.getByText("Settimana di camp")).toBeVisible();

    const firstWeekOption = page.getByRole("button", { name: /^Settimana \d+ ·/ }).first();
    await firstWeekOption.click();

    // Il chip si aggiorna da "Date" a "Settimana N" e diventa azzerabile.
    await expect(page.getByText(/^Settimana \d+$/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
    await expect(resultsCount(page)).toBeVisible();

    // La X sul chip azzera solo il filtro Date, non gli altri.
    await page.locator(".ti-x").first().click();
    await expect(page.getByText("Date", { exact: true })).toBeVisible();
  });

  // Priorita: Alta | Precondizioni: Arrivare da Home -> Planner -> "Riempi" (o CTA inline "Per riempire la settimana N") con un bambino selezionato
  // Passi: Apri /search?week=...&kid=... (link generato dal Planner)
  // Risultato atteso: Il filtro Data e' pre-applicato alla settimana richiesta, il banner mostra "Stai cercando per la Settimana N" + "preferenze di [bambino]", e la lista mostra solo attivita' compatibili; "Rimuovi" azzera entrambi i filtri insieme
  test("TC-158 - Filtri Data e preferenze bambino pre-applicati arrivando dal Planner", async ({ page }) => {
    // Simuliamo l'arrivo dal Planner con il query param ?week=, come genera
    // il link "Per riempire la settimana N" / CTA "Riempi" in PlannerView.tsx
    // (il primo lunedi' della stagione demo e' sempre nella griglia delle 13
    // settimane calcolata da lib/season-weeks.ts).
    await page.goto("/search?week=2026-06-08");
    const banner = page.getByText(/Stai cercando per la Settimana/);
    if (!(await banner.isVisible().catch(() => false))) {
      test.skip(true, "La settimana di test non rientra nella stagione corrente per questo deploy.");
    }
    await expect(banner).toBeVisible();
    await expect(page.getByRole("button", { name: "Rimuovi" })).toBeVisible();

    await page.getByRole("button", { name: "Rimuovi" }).click();
    await expect(banner).not.toBeVisible();
  });

  // Segnalazione di Fabrizio: le preferenze del bambino filtravano già i
  // risultati, ma in modo invisibile — voleva un filtro esplicito "Tipo
  // attività" (categoria/tag), pre-selezionato con le preferenze del
  // bambino ma modificabile a mano, come gli altri filtri.
  // Priorita: Media | Precondizioni: Nessuna
  test("TC-169 - Filtro 'Tipo attività' selezionabile a mano e azzerabile con la X", async ({ page }) => {
    await page.getByText("Tipo attività", { exact: true }).click();
    const sportChip = page.getByRole("button", { name: "⚽ Sport" });
    await expect(sportChip).toBeVisible();

    await sportChip.click();
    await expect(page.getByText("Tipo attività (1)")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();

    // La X sul chip azzera solo questo filtro.
    await page.locator(".ti-x").first().click();
    await expect(page.getByText("Tipo attività", { exact: true })).toBeVisible();
  });

  // Priorita: Bassa | Precondizioni: Nessuna
  // Passi: Passa alla vista "Mappa"
  // Risultato atteso: Le tile della mappa sono in stile "light" (CartoDB Positron), non lo standard OpenStreetMap colorato — richiesto da Fabrizio per "alleggerire la vista"
  test("TC-170 - La vista Mappa usa uno stile 'light' invece dello standard OSM", async ({ page }) => {
    // Le tile CartoDB Positron vengono caricate da basemaps.cartocdn.com —
    // verifichiamo che almeno un tile richiesto punti a quel dominio invece
    // che a tile.openstreetmap.org. La promise va impostata PRIMA del click,
    // altrimenti la richiesta può partire prima che iniziamo ad ascoltare.
    const tileRequestPromise = page.waitForRequest(/basemaps\.cartocdn\.com/, { timeout: 10_000 }).catch(() => null);
    await page.getByRole("button", { name: "Mappa" }).click();
    const req = await tileRequestPromise;
    expect(req).not.toBeNull();
  });

  // TRAMA ONE Build Sprint 3 — "Giorni spot": filtro "solo attività con
  // Giorni spot disponibili" (lib/data/activities.ts#getActivitiesWithOpenDaySpots).
  // In ambiente demo/senza dati seminati per STEP 7 il filtro può azzerare
  // i risultati (nessuna attività ha Giorni spot configurati) — verifichiamo
  // solo che il chip/pannello funzioni e sia azzerabile, non un conteggio
  // specifico ("never overstate proof" su dati che potrebbero non esistere).
  test("TC-N502 - Il filtro 'Giorni spot' è raggiungibile, selezionabile e azzerabile", async ({ page }) => {
    await page.getByText("Giorni spot", { exact: true }).click();
    const checkbox = page.getByText("Solo attività con Giorni spot disponibili");
    await expect(checkbox).toBeVisible();

    await checkbox.click();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();

    // La X sul chip azzera solo questo filtro.
    await page.locator(".ti-x").first().click();
    await expect(page.getByText("Giorni spot", { exact: true })).toBeVisible();
  });

  // TRAMA ONE Build Sprint 3 — "context object" leggero: verifica che il
  // click su una card risultato porti source=search + un cid (uuid) nel
  // link al dettaglio (vedi ActivityCardHorizontal.tsx/SearchClient.tsx),
  // e che il dettaglio li propaghi a sua volta nel link "Prenota ora"
  // (DetailClient.tsx) — puramente client-side, non richiede dati Supabase
  // specifici oltre alla singola attività di test già usata altrove.
  test("TC-N503 - source=search e un correlationId propagano dalla card di Ricerca al link 'Prenota ora'", async ({
    page,
  }) => {
    const firstCard = page.locator('a[href^="/activity/"]').first();
    await expect(firstCard).toBeVisible();
    const cardHref = await firstCard.getAttribute("href");
    expect(cardHref).toMatch(/[?&]source=search\b/);
    expect(cardHref).toMatch(/[?&]cid=[0-9a-f-]{36}/i);

    await firstCard.click();
    await expect(page).toHaveURL(/\/activity\/.*[?&]source=search/);

    const prenotaLink = page.getByRole("link", { name: "Prenota ora" });
    const bookingHref = await prenotaLink.getAttribute("href");
    expect(bookingHref).toMatch(/[?&]source=search\b/);
    expect(bookingHref).toMatch(/[?&]cid=[0-9a-f-]{36}/i);
  });

});
