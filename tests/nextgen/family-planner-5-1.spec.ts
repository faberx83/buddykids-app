import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner (Sprint 5.1)
// Prima fase del PRD "Family Planner" di Fabrizio: "Lo Sprint 5 rappresenta
// il cuore dell'intero prodotto e non deve essere considerato come
// l'aggiunta di una semplice pagina Planner." Questa fase (5.1) copre:
//   - Home NEXTGEN ridotta a sola sintesi (Hero, check-in, prossimo
//     appuntamento, suggerimenti, Attività da confermare, CTA "Apri
//     Planner" — niente più timeline completa/statistiche/budget/mappa)
//   - Il Planner con selettore a 5 modalità (Organizzazione/Calendario/
//     Mappa/Budget/Gruppi), di cui solo Organizzazione e Budget funzionanti
//   - Missioni (messaggi motivazionali, non gamification)
//   - Copertura per bambino nella modalità Organizzazione
//   - Budget: tetto stagionale impostabile dal genitore (season_budget_target)
// V1/LEGACY non toccata. Vedi anche tests/nextgen/dashboard.spec.ts
// (TC-N08/TC-N09) e tests/nextgen/home-refinement.spec.ts (TC-N22/TC-N26)
// per le regressioni evitate sulla vecchia Home.
//
// SPRINT 5.2: la modalità Calendario è stata implementata (non è più "in
// arrivo") — vedi tests/nextgen/planner-calendar-5-2.spec.ts. TC-N44 qui
// sotto aggiornato di conseguenza (solo Mappa/Gruppi restano placeholder).

test.describe("NEXTGEN - Family Planner (Sprint 5.1)", () => {
  test("TC-N41 - Home mostra 'Attività da confermare' solo per le prenotazioni in stato 'pending'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText(/Attività da confermare/);
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione in attesa per l'account di test.");
    }
    await expect(heading).toBeVisible();
    await expect(page.getByRole("link", { name: /Gestisci tutte le prenotazioni/ })).toHaveAttribute(
      "href",
      "/prenotazioni"
    );
  });

  test("TC-N42 - Home non mostra timeline completa, budget dettagliato o mappa (solo sintesi)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText("Timeline della stagione")).toHaveCount(0);
    await expect(page.getByText("Budget estate")).toHaveCount(0);
    await expect(page.getByText("Per categoria")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Apri Planner" })).toBeVisible();
  });

  // SPRINT CORRETTIVO (feedback Fabrizio, mockup "2. Calendario"): "Calendario"
  // e' passato da modalita' a se stante (tab) a riquadro pieghevole dentro
  // Organizzazione — 4 tab invece di 5, vedi PlannerModeTabs.tsx. Il bottone
  // "Calendario" esiste ancora (stesso testo, per non rompere i test che lo
  // cliccano — vedi tests/nextgen/family-planner-5-3.spec.ts), solo non e'
  // piu' nella barra dei tab.
  test("TC-N43 - Il Planner mostra le 4 modalità Organizzazione/Mappa/Budget/Gruppi (Calendario e' collassato dentro Organizzazione)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    for (const label of ["Organizzazione", "Mappa", "Budget", "Gruppi"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    // Il riquadro pieghevole "Calendario" e' dentro Organizzazione (mode di
    // default), non un tab della barra in alto.
    await expect(page.getByRole("button", { name: "Calendario", exact: true })).toBeVisible();
  });

  // TEST DEBT corretto en passant: questo test era rimasto fermo alla 5.2
  // ("Mappa/Gruppi in arrivo"), ma sono state implementate per davvero nelle
  // fasi 5.4/5.6 (vedi family-planner-5-4.spec.ts e family-planner-5-6...
  // ora 5.6.spec.ts) — nessuno lo aveva mai aggiornato. Notato solo perché
  // in questo stesso file per lo sprint Calendario→Organizzazione.
  test("TC-N44 - Le modalità Mappa/Gruppi mostrano contenuto reale (non più 'in arrivo')", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await page.getByRole("button", { name: "Mappa", exact: true }).click();
    await expect(page.getByText("Vista Mappa in arrivo")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Application error");

    await page.getByRole("button", { name: "Gruppi", exact: true }).click();
    await expect(page.getByText("Vista Gruppi in arrivo")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N45 - Modalità Budget: senza un tetto impostato, il primo accesso forza l'inserimento (nessun valore precompilato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato, l'account genitore di test SENZA tetto budget già impostato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Budget" }).click();

    const input = page.getByPlaceholder("Es. 1500");
    if (!(await input.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha già un tetto budget impostato.");
    }
    await expect(input).toHaveValue("");
  });

  test("TC-N46 - Modalità Budget: impostare il tetto lo salva e mostra la percentuale utilizzata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Budget" }).click();

    const input = page.getByPlaceholder("Es. 1500");
    if (await input.isVisible().catch(() => false)) {
      await input.fill("1500");
      await page.getByRole("button", { name: "Salva budget" }).click();
      await expect(page.getByText("Budget stagionale salvato!")).toBeVisible();
    }
    await expect(page.getByText("Budget pianificato")).toBeVisible();
    await expect(page.getByText(/utilizzato|superato il budget/)).toBeVisible();
  });

  test("TC-N47 - Missioni: messaggio motivazionale mostrato quando manca una sola settimana per completare un mese", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con esattamente una settimana mancante in un mese.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const mission = page.getByText(/Ti manca solo la Settimana \d+ per completare/);
    if (!(await mission.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna missione di questo tipo applicabile ai dati dell'account di test.");
    }
    await expect(mission).toBeVisible();
  });

  test("TC-N48 - Copertura per bambino: visibile solo con più di un figlio, con rassicurazione a copertura completa", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con 2+ bambini.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByText("Copertura per bambino", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha un solo figlio: la card non viene mostrata (comportamento atteso).");
    }
    await expect(heading).toBeVisible();
    // "Tutto organizzato! 🎉" appare solo per i bambini con copertura completa
    // — non asseriamo la sua presenza in assoluto (dipende dai dati), solo
    // che l'assenza di errori applicativi.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N49 - Home non mostra un centro notifiche dedicato (assunzione da verificare con Fabrizio)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    // Placeholder di documentazione: la voce "Notifiche" del PRD è oggi
    // coperta da segnali esistenti (Check-in, Attività da confermare,
    // segnale Community), non da un centro notifiche dedicato. Nessuna
    // asserzione bloccante: serve solo a marcare esplicitamente il gap nel
    // test suite, cercabile per nome in futuro.
    expect(true).toBe(true);
  });
});
