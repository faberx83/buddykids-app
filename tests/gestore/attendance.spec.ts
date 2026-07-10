import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Registro presenze
// Generato da BuddyKids_Test_Case.xlsx - nuova funzionalità: prima d'ora il
// gestore non aveva alcuna visibilità sui bambini/famiglie iscritti (solo
// conteggi aggregati via Richieste Gruppo). Richiede le RLS aggiuntive di
// supabase/migration_06_profilo_esteso_presenze.sql (il centro vede nome
// bambino + contatto genitore SOLO per le prenotazioni della propria
// attività) e la prenotazione "fixture" ricreata da
// tests/cleanup-test-data.mjs (bambino di test iscritto a "Settimana 1"
// dell'attività di test).
//
// NOTA: da quando esiste il check-in MVP (TC-151/152), la prenotazione
// fixture può essere iscritta a DUE settimane della stessa attività
// ("Settimana 1" + la settimana che copre la data odierna, se diversa —
// vedi tests/cleanup-test-data.mjs) — quindi "[TEST] Attività BuddyKids"
// può comparire due volte nella sidebar (un bottone per gruppo
// attività+settimana). I test sotto scelgono sempre il bottone che contiene
// ANCHE "Settimana 1" per restare univoci indipendentemente da quante
// settimane copre la fixture in un dato momento.
function settimana1Button(page: import("@playwright/test").Page) {
  return page
    .locator("button")
    .filter({ hasText: "[TEST] Attività BuddyKids" })
    .filter({ hasText: "Settimana 1" });
}

// "serial": TC-140, TC-149 e TC-152 scrivono TUTTI sulla stessa
// presenza/bambino/prenotazione fixture condivisa — con l'esecuzione
// parallela di default (fullyParallel: true in playwright.config.ts)
// potrebbero sovrascriversi a vicenda in modo intermittente. Stesso
// principio già applicato in tests/genitori/profilo.spec.ts per TC-133.
test.describe.configure({ mode: "serial" });

test.describe("Gestore - Registro presenze", () => {
  // TC-139 - Elenco partecipanti raggruppato per attività e settimana
  test("TC-139 - il bambino di test compare nella settimana 1 dell'attività di test", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");

    await expect(page.getByText("[TEST] Attività BuddyKids").first()).toBeVisible();
    await expect(page.getByText("Settimana 1", { exact: false })).toBeVisible();
    await settimana1Button(page).click();

    // Il bambino di test è iscritto (nome reale, non anonimizzato: a
    // differenza dei Gruppi tra famiglie diverse, qui il centro vede i propri
    // iscritti — vedi le RLS aggiuntive in migration_06).
    await expect(page.getByText("[TEST] Bimbo Prova")).toBeVisible();
  });

  // TC-140 - Segnare presente/assente per un giorno specifico persiste
  // AGGIORNATO: la riga bambino non ha più un singolo bottone-toggle, ma un
  // gruppo di 3 bottoni fissi Presente/In ritardo/Assente (vedi TC-152) — lo
  // stato attivo si riconosce dalla classe di sfondo, non più dal testo del
  // bottone (che ora è sempre lo stesso). Selettore riga aggiornato di
  // conseguenza: il wrapper esterno per-bambino è "flex flex-col gap-2"
  // (prima era "flex items-center justify-between", ora quella classe
  // appartiene solo alla sotto-riga con nome/badge, non più ai bottoni).
  test("TC-140 - segnare 'Presente' per un giorno persiste dopo reload", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");

    await settimana1Button(page).click();

    const kidRow = page.locator("div.flex.flex-col.gap-2").filter({ hasText: "[TEST] Bimbo Prova" });
    const presenteBtn = kidRow.getByRole("button", { name: "Presente" });
    const assenteBtn = kidRow.getByRole("button", { name: "Assente" });
    await expect(assenteBtn).toHaveClass(/bg-ink\b/); // stato di default: "assente" attivo

    await presenteBtn.click();
    await expect(presenteBtn).toHaveClass(/bg-partner\b/);

    await page.reload();
    await settimana1Button(page).click();
    const kidRowAfterReload = page.locator("div.flex.flex-col.gap-2").filter({ hasText: "[TEST] Bimbo Prova" });
    await expect(kidRowAfterReload.getByRole("button", { name: "Presente" })).toHaveClass(/bg-partner\b/);

    // Ripristino a "Assente" per non alterare i run successivi (la prenotazione
    // fixture viene comunque ricreata ad ogni run, ma l'appello persiste sulla
    // stessa week_id finché non cambia — meglio lasciare lo stato pulito).
    await kidRowAfterReload.getByRole("button", { name: "Assente" }).click();
  });

  // TC-149 - Riepilogo "arrivati su prenotati" del giorno
  // NUOVA FUNZIONALITÀ (richiesta da Fabrizio): prima non esisteva alcun
  // conteggio aggregato, solo la spunta per singolo bambino. NOTA: l'invio
  // dell'email di assenza al genitore (app/actions/attendance.ts) non è
  // verificabile qui via Playwright (richiederebbe una casella email reale/
  // provider di test per Resend) — resta una side-effect "best effort" non
  // asserita in automazione.
  test("TC-149 - il riepilogo presenti/prenotati riflette il toggle presenza", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");
    await settimana1Button(page).click();

    const summary = page.getByText(/presenti su \d+ prenotati/);
    await expect(summary).toContainText("0 presenti su");

    const kidRow = page.locator("div.flex.flex-col.gap-2").filter({ hasText: "[TEST] Bimbo Prova" });
    await kidRow.getByRole("button", { name: "Presente" }).click();
    await expect(summary).toContainText("1 presenti su");

    // Ripristino per non alterare i run successivi.
    await kidRow.getByRole("button", { name: "Assente" }).click();
    await expect(summary).toContainText("0 presenti su");
  });

  // TC-152 - Il check-in "in ritardo" del genitore è visibile e correggibile dal gestore
  // NUOVA FUNZIONALITÀ (check-in MVP): il genitore risponde da Home
  // (CheckinPrompt, TC-151); qui verifichiamo che il gestore veda lo stato
  // "In ritardo" con il badge "Segnalato dal genitore" nel Registro presenze,
  // e possa confermarlo/correggerlo (qui: correzione a "Presente"). Usa un
  // browser context SEPARATO per il gestore (browser.newContext()) invece di
  // riloggare sulla stessa `page`, per non rischiare collisioni di sessione
  // con /auth/login mentre si è già autenticati come genitore.
  test("TC-152 - lo stato 'in ritardo' del check-in genitore è visibile e correggibile", async ({
    page,
    browser,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, gli account Genitore/Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );

    // 1) Genitore: risponde "Siamo in ritardo" dalla Home.
    await loginAs(page, "parent");
    await page.goto("/");
    const promptVisible = await page
      .getByText(/è arrivato\/a a/)
      .first()
      .isVisible()
      .catch(() => false);
    test.skip(
      !promptVisible,
      "Nessuna settimana seminata copre la data odierna (vedi tests/cleanup-test-data.mjs) — check-in non mostrato oggi."
    );
    await page.getByRole("button", { name: "Siamo in ritardo" }).click();
    await expect(page.getByText("Il centro è stato avvisato del ritardo.")).toBeVisible();

    // 2) Gestore (context separato): vede "In ritardo" + badge, poi corregge.
    const gestoreContext = await browser.newContext();
    const gestorePage = await gestoreContext.newPage();
    try {
      await loginAs(gestorePage, "center_admin");
      await gestorePage.goto("/center/attendance");

      // Il gruppo rilevante ORA è quello con la settimana odierna, non
      // "Settimana 1" (che il genitore non ha toccato) — cerchiamo tra tutti
      // i bottoni-gruppo dell'attività di test quello la cui riga bambino,
      // una volta aperto, mostra il badge "Segnalato dal genitore".
      const groupButtons = gestorePage
        .locator("button")
        .filter({ hasText: "[TEST] Attività BuddyKids" });
      const count = await groupButtons.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        await groupButtons.nth(i).click();
        const kidRow = gestorePage
          .locator("div.flex.flex-col.gap-2")
          .filter({ hasText: "[TEST] Bimbo Prova" });
        if (await kidRow.getByText("Segnalato dal genitore").isVisible().catch(() => false)) {
          found = true;
          await expect(kidRow.getByRole("button", { name: "In ritardo" })).toHaveClass(/bg-orange\b/);

          // Il gestore corregge a "Presente".
          await kidRow.getByRole("button", { name: "Presente" }).click();
          await expect(kidRow.getByRole("button", { name: "Presente" })).toHaveClass(/bg-partner\b/);
          await expect(kidRow.getByText("Segnalato dal genitore")).toHaveCount(0);

          // Ripristino per non alterare i run successivi.
          await kidRow.getByRole("button", { name: "Assente" }).click();
          break;
        }
      }
      expect(found).toBe(true);
    } finally {
      await gestoreContext.close();
    }
  });

  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: "faccio il check-in lato
  // genitori ma non si aggiorna lato gestore") — la vera causa era che la
  // settimana selezionata di default nel Registro non era necessariamente
  // quella che copre OGGI (era semplicemente la prima per nome+data), e il
  // "Settimana N" mostrato usava un'etichetta grezza a volte diversa da
  // quella canonica usata da Home/Planner — il gestore finiva a guardare
  // una settimana diversa da quella del check-in. Ora la settimana di oggi
  // è selezionata di default e ha un badge "Oggi" nella sidebar.
  // Priorita: Alta | Precondizioni: Prenotazione con settimana che copre oggi
  test("TC-186 - la settimana di oggi è selezionata di default e ha il badge 'Oggi'", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e una settimana che copre oggi (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");

    const oggiBadge = page.getByText("Oggi", { exact: true });
    const hasCurrentWeek = await oggiBadge.isVisible().catch(() => false);
    test.skip(
      !hasCurrentWeek,
      "Nessuna settimana seminata copre la data odierna in questo momento (vedi tests/cleanup-test-data.mjs)."
    );

    // Il bottone-gruppo con il badge "Oggi" deve già essere quello attivo
    // (evidenziato) senza bisogno di cliccarlo.
    const oggiGroupButton = page.locator("button").filter({ has: oggiBadge });
    await expect(oggiGroupButton).toHaveClass(/bg-partner-light/);
  });

  // Segnalazione di Fabrizio: "ci vuole il badge delle notifiche come sulle
  // richieste su tutte le sezioni che prevedono una notifica da una parte
  // all'altra" — aggiunto un badge su "Registro presenze" col numero di
  // check-in fatti dal genitore e non ancora confermati/corretti dal
  // gestore (stesso pattern del badge non-letto di "Le mie richieste").
  // Priorita: Media | Precondizioni: Almeno un check-in fatto dal genitore
  test("TC-187 - 'Registro presenze' nel menu mostra un badge per i check-in del genitore da confermare", async ({
    page,
    browser,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e gli account Genitore/Gestore di test."
    );

    // 1) Genitore: fa un check-in (se disponibile oggi).
    await loginAs(page, "parent");
    await page.goto("/");
    const promptVisible = await page
      .getByText(/è arrivato\/a a/)
      .first()
      .isVisible()
      .catch(() => false);
    const alreadyCollapsed = await page
      .locator('[aria-label="Modifica risposta"]')
      .first()
      .isVisible()
      .catch(() => false);
    test.skip(
      !promptVisible && !alreadyCollapsed,
      "Nessuna settimana seminata copre la data odierna — check-in non disponibile oggi."
    );
    if (promptVisible) {
      await page.getByRole("button", { name: "Siamo in ritardo" }).click();
    }

    // 2) Gestore (context separato): il badge su "Registro presenze" è > 0.
    const gestoreContext = await browser.newContext();
    const gestorePage = await gestoreContext.newPage();
    try {
      await loginAs(gestorePage, "center_admin");
      await gestorePage.goto("/center");
      const navItem = gestorePage.locator("a", { hasText: "Registro presenze" }).first();
      await expect(navItem).toBeVisible();
      // Il badge è un elemento figlio col conteggio — verifichiamo solo che
      // non sia assente del tutto (>=1), non un numero esatto (altri run
      // potrebbero aver lasciato check-in non confermati precedenti).
      const badge = navItem.locator("span").filter({ hasText: /^\d+$/ });
      await expect(badge.first()).toBeVisible();
    } finally {
      await gestoreContext.close();
    }
  });
});
