import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE Build Sprint 4 (DEC-42) — Inbox prenotazioni del Partner
// (/center/prenotazioni): risposta accetta/rifiuta/proponi a una
// prenotazione, con propagazione visibile al genitore in "Le mie
// prenotazioni" (badge "novità" + eventuale nota di proposta). Stesso
// pattern a due context browser già usato in tests/gestore/richieste.spec.ts
// per il ticketing (TC-163/TC-178).
//
// Precondizione dati: supabase/seed-test-data.sql STEP 8 — una prenotazione
// "pending" deterministica (total_amount = 0.01, marcatore) sull'attività di
// test, per l'account Genitore di test, così il test non dipende da
// prenotazioni reali create da altri test in ordine non garantito.
const TEST_ACTIVITY_NAME = "[TEST] Attività BuddyKids";

test.describe.configure({ mode: "serial" });

test.describe("Gestore - Prenotazioni (risposta Partner)", () => {
  // Priorita: Alta | Precondizioni: seed STEP 8 applicato (prenotazione di test "pending")
  test("TC-508 - Il centro vede la prenotazione di test in 'Da rispondere' e la accetta", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, migration_13 applicata e supabase/seed-test-data.sql STEP 8 eseguito."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/prenotazioni");

    // Gate C (28/07, quarta ondata): il filtro "Da rispondere" da solo NON
    // basta a isolare il marcatore, nemmeno dopo aver esteso la DELETE di
    // cleanup-test-data.mjs a activity_id (commit efea04d) — perché la causa
    // non è più dato residuo tra run, ma CONCORRENZA dentro lo stesso run.
    // tests/genitori/prenotazione.spec.ts (TC-111/TC-112) completa
    // prenotazioni REALI sulla stessa TEST_ACTIVITY_NAME e con
    // fullyParallel:true + workers:2 (playwright.config.ts) può girare in
    // parallelo a questo file su un worker diverso: quella prenotazione nasce
    // con partner_decision='pending' ("Da rispondere") e resta tale finché
    // nessuno la accetta/rifiuta — una seconda riga legittima, non un dato
    // sporco. Il marcatore seed (STEP 8) è invece l'UNICA prenotazione con
    // total_amount = 0.01 (mai il prezzo reale dell'attività): filtriamo
    // anche su "€0.01" per isolarlo indipendentemente da quante altre
    // prenotazioni "Da rispondere" esistano in quel momento sulla stessa
    // attività.
    const row = page
      .getByTestId("booking-row")
      .filter({ hasText: TEST_ACTIVITY_NAME })
      .filter({ hasText: "Da rispondere" })
      .filter({ hasText: "€0.01" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Da rispondere")).toBeVisible();

    await row.getByRole("button", { name: "Accetta" }).click();
    await expect(row.getByText("Accettata")).toBeVisible();
  });

  // Priorita: Alta | Precondizioni: TC-508 già eseguito (o comunque una
  // prenotazione con partner_decision = 'accepted' per il genitore di test).
  test("TC-509 - Il genitore vede la prenotazione accettata come 'Confermata' in 'Le mie prenotazioni'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Genitore di test.");

    await loginAs(page, "parent");
    await page.goto("/prenotazioni");

    const row = page.locator("div").filter({ hasText: TEST_ACTIVITY_NAME }).last();
    await expect(row).toBeVisible();
    await expect(row.getByText("Confermata")).toBeVisible();
  });

  // Verifica lo stato vuoto (stesso principio di TC-164 per le richieste):
  // la pagina non deve mai andare in errore, anche senza prenotazioni in
  // attesa — mostra sempre le due sezioni con il conteggio.
  test("TC-510 - Stato di 'Prenotazioni' lato gestore mostra sempre le due sezioni con conteggio", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");

    await loginAs(page, "center_admin");
    await page.goto("/center/prenotazioni");
    await expect(page.getByText(/Da rispondere \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Storico \(\d+\)/)).toBeVisible();
  });
});
