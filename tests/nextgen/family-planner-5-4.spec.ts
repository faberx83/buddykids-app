import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner, Sprint 5.4 (Vista Mappa + Promemoria)
// Quarta fase del PRD "Family Planner": Vista Mappa (pin REALI dai
// centri/attività — activities.latitude/longitude, già usati da LEGACY
// Cerca — riusa components/ActivityMap.tsx tale e quale) con distanza/tempo
// di percorrenza STUBBATI ma VISIBILI dagli indirizzi di famiglia (scelta
// esplicita di Fabrizio: quegli indirizzi sono testo libero senza
// coordinate, nessuna API mappe a pagamento configurata — vedi
// lib/nextgen/planner-map-estimate.ts) e "Promemoria intelligenti" (dati
// reali: finestra di cancellazione, attività in arrivo, settimana
// prioritaria, sovrapposizioni, budget — lib/nextgen/reminders.ts).
// Nessuna nuova query pesante: mapPins riusa activities già lette dai
// booking del genitore; reminders riusa PlannerData/MyBooking/overlaps/
// budget già letti da app/nextgen/planner/page.tsx.

test.describe("NEXTGEN - Family Planner Sprint 5.4 (Mappa/Promemoria)", () => {
  test("TC-N66 - Vista Mappa: con attività prenotate mostra 'Le tue attività' con distanza stimata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const list = page.getByText("Le tue attività", { exact: true });
    if (!(await list.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata per l'account di test.");
    }
    await expect(list).toBeVisible();
    await expect(page.getByText("distanza stimata")).toBeVisible();
    await expect(page.getByText(/km · \d+ min|Indirizzo non disponibile/).first()).toBeVisible();
  });

  // BUGFIX (segnalato da Fabrizio: "la mappa restituisce 'This page couldn't
  // load'", riproducibile sempre, sia web che PWA) — react-leaflet passava
  // icon={undefined} per ogni pin non selezionato; Leaflet applica le
  // options con un for...in che copia anche chiavi undefined, sovrascrivendo
  // l'icona di default e facendo crashare _initIcon al primo render (nessun
  // pin è mai selezionato all'apertura). Fix in ActivityMap.tsx: la prop
  // "icon" ora viene passata SOLO quando c'è un'icona di selezione da
  // applicare, mai come undefined esplicito.
  test("TC-N109 - Vista Mappa: non crasha al primo render (nessun pin ancora selezionato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva con coordinate.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("couldn't load");
    // Se ci sono attività con coordinate, la mappa Leaflet deve montarsi e
    // disegnare almeno un marker senza eccezioni.
    const mapContainer = page.locator(".leaflet-container");
    if (await mapContainer.isVisible().catch(() => false)) {
      await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
    }
  });

  test("TC-N67 - Vista Mappa: senza prenotazioni attive mostra lo stato vuoto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test SENZA prenotazioni attive.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const emptyState = page.getByText(/Prenota un.attività per vederla qui sulla mappa/);
    if (!(await emptyState.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha già attività prenotate.");
    }
    await expect(emptyState).toBeVisible();
  });

  // SPRINT CORRETTIVO (mockup "3. Mappa"): cliccare una riga della lista non
  // naviga più direttamente — seleziona il pin (stessa selezione di un click
  // sulla mappa) e mostra la scheda sintetica sotto, con "Apri scheda" e
  // "Avvia navigazione" — vedi PlannerMapView.tsx.
  test("TC-N68 - Vista Mappa: toccare un'attività nell'elenco mostra la scheda sintetica con 'Apri scheda'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva con coordinate.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const firstRow = page.getByText("Le tue attività", { exact: true }).locator("..").locator("button").first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata con coordinate per l'account di test.");
    }
    await firstRow.click();

    const openCard = page.getByRole("link", { name: "Apri scheda" });
    await expect(openCard).toBeVisible();
    await openCard.click();
    await expect(page).toHaveURL(/\/activity\//);
  });

  // SPRINT CORRETTIVO (Organizzazione semplificata): Promemoria e Missioni
  // sono ora un'unica lista di "avvisi", di cui ne compare UNO solo di
  // default (vedi tests/nextgen/planner-organizzazione-semplificata.spec.ts
  // #TC-N97 per il dettaglio "Mostra tutti"). Qui verifichiamo solo che il
  // rendering non si rompa, non più il limite di 4 (non più applicabile: di
  // default ne compare al massimo 1).
  test("TC-N69 - Avvisi (Promemoria+Missioni unificati): il rendering di Organizzazione non si rompe", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // SPRINT CORRETTIVO (mockup "3. Mappa"): scheda sintetica con "✕" per
  // tornare alla lista, e "Avvia navigazione" solo quando l'attività ha un
  // indirizzo salvato.
  test("TC-N101 - Vista Mappa: la scheda sintetica ha un pulsante per tornare alla lista completa", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva con coordinate.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const firstRow = page.getByText("Le tue attività", { exact: true }).locator("..").locator("button").first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata con coordinate per l'account di test.");
    }
    await firstRow.click();
    await expect(page.getByRole("link", { name: "Apri scheda" })).toBeVisible();

    await page.getByLabel("Chiudi scheda").click();
    await expect(page.getByText("Le tue attività", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Apri scheda" })).toHaveCount(0);
  });

  test("TC-N102 - Vista Mappa: 'Avvia navigazione' compare solo se l'attività ha un indirizzo salvato", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva con indirizzo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const firstRow = page.getByText("Le tue attività", { exact: true }).locator("..").locator("button").first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata con coordinate per l'account di test.");
    }
    await firstRow.click();

    const navigateLink = page.getByRole("link", { name: "Avvia navigazione" });
    if (!(await navigateLink.isVisible().catch(() => false))) {
      test.skip(true, "L'attività selezionata non ha un indirizzo salvato nell'account di test.");
    }
    await expect(navigateLink).toHaveAttribute("href", /google\.com\/maps/);
  });

  // SPRINT 4 correttivo (feedback Fabrizio, mockup "3. Mappa": "va bene
  // metter origine uno degli indirizzi, ma lasciare scelta all'utente") —
  // se la famiglia ha almeno un indirizzo salvato, compare un selettore
  // "Parti da" e il link "Avvia navigazione" diventa un itinerario
  // (origin+destination), non più solo la ricerca della destinazione.
  test("TC-N283 - Vista Mappa: con indirizzi salvati, 'Parti da' costruisce un link di itinerario (non solo destinazione)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, un account genitore con una prenotazione con indirizzo e almeno un indirizzo di famiglia salvato."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const firstRow = page.getByText("Le tue attività", { exact: true }).locator("..").locator("button").first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata con coordinate per l'account di test.");
    }
    await firstRow.click();

    const originPicker = page.getByText("Parti da", { exact: true });
    if (!(await originPicker.isVisible().catch(() => false))) {
      test.skip(true, "Nessun indirizzo di famiglia salvato per l'account di test.");
    }
    await expect(originPicker).toBeVisible();

    const navigateLink = page.getByRole("link", { name: "Avvia navigazione" });
    if (!(await navigateLink.isVisible().catch(() => false))) {
      test.skip(true, "L'attività selezionata non ha un indirizzo salvato nell'account di test.");
    }
    await expect(navigateLink).toHaveAttribute("href", /maps\/dir\/\?api=1&origin=/);
  });
});
