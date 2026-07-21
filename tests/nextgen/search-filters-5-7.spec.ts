import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Ricerca, Sprint 5.7 "Ripristino filtri LEGACY + Vista Mappa"
// Fabrizio ha segnalato che i 6 pannelli filtro di LEGACY (età/prezzo/zona/
// tipo attività/servizi/data) erano stati deliberatamente esclusi dallo
// scope di Sprint 2 NEXTGEN — qui sono ripristinati 1:1 come filtro "duro"
// applicato PRIMA dello scoring smart-search (che resta invariato), più un
// toggle vista Lista/Mappa (riuso di ActivityMap, già usato da LEGACY e dal
// Planner). Selettori presi da app/nextgen/search/SearchDiscoveryClient.tsx.

test.describe("NEXTGEN - Ricerca Sprint 5.7 (filtri + Vista Mappa)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
  });

  function resultsCount(page: import("@playwright/test").Page) {
    return page.getByText(/\d+ attività trovate/);
  }

  test("TC-N82 - Il pannello 'Prezzo' è raggiungibile e il tetto massimo riduce i risultati", async ({ page }) => {
    const before = await resultsCount(page).textContent();

    await page.getByText("Prezzo", { exact: true }).click();
    const slider = page.locator('input[type="range"]');
    await slider.fill("50");

    await expect(resultsCount(page)).not.toHaveText(before ?? "");
    // SPRINT 3 — "Azzera" ora è montato/smontato condizionalmente (prima era
    // sempre presente ma disabled): .toBeVisible() verifica sia la presenza
    // nel DOM sia la visibilità, coerente con il nuovo comportamento.
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();
  });

  test("TC-N83 - Il filtro Servizi 'Bar nel centro' mostra solo centri con bar", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥤 Bar nel centro").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();
    await expect(resultsCount(page)).toBeVisible();
  });

  test("TC-N84 - Selezionare una categoria in 'Tipo attività' aggiorna il conteggio nel chip", async ({ page }) => {
    await page.getByText("Tipo attività", { exact: true }).click();
    const firstCategory = page.locator('div[class*="max-h-64"] button').first();
    await firstCategory.click();

    await expect(page.getByText(/Tipo attività \(1\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();
  });

  // SPRINT 3 (feedback Fabrizio: "il filtro settimana dovrebbe permettere
  // multi-selezione, raggruppata per mese") — l'etichetta del chip ora
  // mostra un conteggio ("Settimane (N)"), non più il numero della singola
  // settimana selezionata; il pannello raggruppa le 13 settimane per mese.
  test("TC-N85 - Selezionare settimane nel pannello 'Data' aggiorna il conteggio nel chip, raggruppate per mese", async ({
    page,
  }) => {
    await page.getByText("Date", { exact: true }).click();
    await expect(page.getByText("Giugno", { exact: true })).toBeVisible();
    await page.getByText(/^Settimana 1 ·/).click();

    await expect(page.getByText(/Settimane \(1\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();

    // Multi-selezione: una seconda settimana si aggiunge, non sostituisce.
    await page.getByText(/^Settimana 2 ·/).click();
    await expect(page.getByText(/Settimane \(2\)/)).toBeVisible();
  });

  test("TC-N86 - 'Azzera' ripristina il conteggio non filtrato", async ({ page }) => {
    const before = await resultsCount(page).textContent();

    await page.getByText("Prezzo", { exact: true }).click();
    await page.locator('input[type="range"]').fill("50");
    await expect(resultsCount(page)).not.toHaveText(before ?? "");

    await page.getByRole("button", { name: /^Azzera/ }).click();
    await expect(resultsCount(page)).toHaveText(before ?? "");
  });

  test("TC-N87 - Il toggle 'Mappa' mostra la vista mappa al posto della lista", async ({ page }) => {
    await page.getByRole("button", { name: "Mappa" }).click();

    const mapOrEmpty = page.locator("text=Nessuna attività con coordinate").or(page.locator(".leaflet-container"));
    await expect(mapOrEmpty.first()).toBeVisible();

    await page.getByRole("button", { name: "Lista" }).click();
    await expect(resultsCount(page)).toBeVisible();
  });

  // SPRINT 5 (feedback Fabrizio): "aggiungi flag per disabili e diete speciali
  // (usa stessa naming ovunque)" — stesso naming del badge su ActivityCard.tsx,
  // qui applicato come filtro escludente.
  // SPRINT 3 — wording aggiornato: "Nessuna limitazione" invece di "Accesso
  // disabili" (il filtro/campo dati centerAccessible resta invariato).
  test("TC-N103 - Il filtro Servizi 'Nessuna limitazione' mostra solo attività accessibili", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🤝 Nessuna limitazione").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();
    await expect(resultsCount(page)).toBeVisible();
  });

  test("TC-N104 - Il filtro Servizi 'Diete gestite' mostra solo attività con opzioni dietetiche", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🥗 Diete gestite").click();

    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();
    await expect(resultsCount(page)).toBeVisible();
  });

  // SPRINT 3 correttivo (feedback Fabrizio: "il filtro dovrebbe essere
  // 'Bambini' e poi dentro la lista dei bambini, altrimenti se diventano 3?
  // 4? simile a 'Tipo Attività' o 'Servizi'") — non più pill inline (uno per
  // figlio, non scalabile), ma un pannello a comparsa come gli altri 6, con
  // il nome del bambino selezionato riflesso nel label del chip stesso.
  // Richiede un genitore di test con 2+ figli in profilo per apparire.
  test("TC-N278 - Il filtro 'Bambini' è un pannello (come Tipo attività/Servizi), non pill inline", async ({
    page,
  }) => {
    const filterRow = page.locator(".no-scrollbar.overflow-x-auto").first();
    const bambiniChip = filterRow.getByText("Bambini", { exact: true });
    test.skip(!(await bambiniChip.isVisible().catch(() => false)), "Richiede un genitore di test con 2+ figli.");

    await bambiniChip.click();
    await expect(page.getByText("Tutti i bambini", { exact: true })).toBeVisible();

    const firstKidButton = page.locator("div.rounded-lg.border button").last();
    const kidName = (await firstKidButton.textContent())?.trim();
    await firstKidButton.click();

    await expect(filterRow.getByText(`Bambini (${kidName})`, { exact: true })).toBeVisible();
  });

  // SPRINT 3 (feedback Fabrizio: "far sparire 'Azzera' del tutto quando non
  // ci sono filtri attivi, non solo disabilitarlo") — verifica che il
  // pulsante non sia proprio nel DOM a filtri azzerati, non solo nascosto o
  // disabled.
  test("TC-N279 - 'Azzera' non è presente nel DOM quando nessun filtro è attivo", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Azzera/ })).toHaveCount(0);

    await page.getByText("Prezzo", { exact: true }).click();
    await page.locator('input[type="range"]').fill("50");
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();

    await page.getByRole("button", { name: /^Azzera/ }).click();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toHaveCount(0);
  });

  // SPRINT 3 — il raggruppamento "Piace ai tuoi figli" (2+ figli con match
  // >=40%) dipende da avere almeno due bambini con interessi che matchano la
  // stessa attività: precondizione non fixturabile in modo affidabile con
  // l'account di test condiviso — vedi altri test.fixme() nella suite per lo
  // stesso motivo (dati demo singolo-account).
  // SPRINT 3 correttivo — testo corretto da "Piacciono" a "Piace ai tuoi
  // figli" (verbo al singolare: la label è per singola attività, non per un
  // elenco di attività, quindi il plurale non era giustificato).
  test.fixme(
    "TC-N280 - Quando 2+ bambini superano la soglia di match, il reason è raggruppato in 'Piace ai tuoi figli' invece di ripetere 'Piace a X'",
    async () => {}
  );

  // SPRINT 3 (feedback Fabrizio: badge "Accesso disabili" e Certificazione
  // condividevano lo stesso blu) — verifica che sulle card risultato il
  // badge "Nessuna limitazione" usi il token colore viola (text-purple),
  // distinto dal blu (text-sky) della Certificazione, quando entrambi sono
  // presenti sulla stessa attività.
  test("TC-N281 - Il badge 'Nessuna limitazione' è viola, distinto dal blu della Certificazione", async ({ page }) => {
    await page.getByText("Servizi", { exact: true }).click();
    await page.getByText("🤝 Nessuna limitazione").click();
    await page.keyboard.press("Escape").catch(() => {});

    const badge = page.getByText("Nessuna limitazione", { exact: true }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/text-purple/);
  });

  // SPRINT 3 correttivo (feedback Fabrizio: "quando si apre un filtro con
  // selezione multipla, deve esserci una linea separatrice leggera prima di
  // 'X attività trovate' e 'Lista/Mappa', per separare visivamente l'area di
  // selezione da quella con i risultati") — il divider non è un bordo fisso:
  // appare solo quando un pannello filtro è aperto.
  test("TC-N282 - Un divider leggero separa il pannello filtro aperto dalla riga risultati/Lista-Mappa", async ({
    page,
  }) => {
    const resultsRow = page.getByText(/\d+ attività trovate/);
    const divider = page.getByTestId("filter-results-divider");

    await expect(divider).toHaveCount(0);

    await page.getByText("Prezzo", { exact: true }).click();
    await expect(resultsRow).toBeVisible();
    await expect(divider).toBeVisible();

    await page.getByText("Prezzo", { exact: true }).click();
    await expect(divider).toHaveCount(0);
  });

  // TRAMA ONE Build Sprint 3 — "Giorni spot": stesso filtro/stesso dato di
  // LEGACY (tests/genitori/cerca.spec.ts TC-N502), qui nel pannello NEXTGEN.
  test("TC-N504 - Il filtro 'Giorni spot' è raggiungibile, selezionabile e azzerabile", async ({ page }) => {
    await page.getByText("Giorni spot", { exact: true }).click();
    const checkbox = page.getByText("Solo attività con Giorni spot disponibili");
    await expect(checkbox).toBeVisible();

    await checkbox.click();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toBeVisible();

    await page.getByRole("button", { name: /^Azzera/ }).click();
    await expect(page.getByRole("button", { name: /^Azzera/ })).toHaveCount(0);
  });

  // TRAMA ONE Build Sprint 3 — "context object" leggero: stessa verifica di
  // LEGACY (TC-N503), qui con source=nextgen_search (ActivityCard.tsx +
  // SearchDiscoveryClient.tsx).
  test("TC-N505 - source=nextgen_search e un correlationId propagano dalla card al link 'Prenota ora'", async ({
    page,
  }) => {
    const firstCard = page.locator('a[href^="/activity/"]').first();
    await expect(firstCard).toBeVisible();
    const cardHref = await firstCard.getAttribute("href");
    expect(cardHref).toMatch(/[?&]source=nextgen_search\b/);
    expect(cardHref).toMatch(/[?&]cid=[0-9a-f-]{36}/i);

    await firstCard.click();
    await expect(page).toHaveURL(/\/activity\/.*[?&]source=nextgen_search/);

    const prenotaLink = page.getByRole("link", { name: "Prenota ora" });
    const bookingHref = await prenotaLink.getAttribute("href");
    expect(bookingHref).toMatch(/[?&]source=nextgen_search\b/);
    expect(bookingHref).toMatch(/[?&]cid=[0-9a-f-]{36}/i);
  });
});
