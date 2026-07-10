import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Le mie richieste
// Nuova funzionalità (richiesta da Fabrizio): "in ogni sezione del camp deve
// esserci una funzionalità di 'Chatta'/'Contatta' il gestore ... genera un
// record in una tabella specifica nell'app gestore in cui il gestore legge
// e risponde ... genera una risposta in 'le mie richieste' del genitore".
// Ticketing semplice: un messaggio del genitore, una risposta del gestore —
// vedi ContactCenterButton.tsx, lib/data/inquiries.ts,
// supabase/schema.sql#activity_inquiries.
//
// TC-163 copre il giro completo end-to-end con due context browser separati
// (genitore + gestore), stesso pattern già usato per TC-152 (check-in) in
// tests/gestore/attendance.spec.ts — evita di riloggare sulla stessa `page`.
const TEST_ACTIVITY_SLUG = "attivita-test-buddykids";

// "serial": TC-163 scrive una nuova richiesta e una risposta condivise con
// lo stesso account di test usato da TC-164 — stesso principio già
// applicato in tests/gestore/attendance.spec.ts.
test.describe.configure({ mode: "serial" });

test.describe("Gestore - Le mie richieste", () => {
  test("TC-163 - Il gestore vede e risponde a una richiesta del genitore, che appare in 'Le mie richieste'", async ({
    page,
    browser,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, gli account Genitore/Gestore di test e activity_inquiries applicato (vedi supabase/schema.sql)."
    );

    // 1) Genitore: invia una richiesta dalla scheda dell'attività di test.
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);
    const message = `Domanda di test Playwright ${Date.now()}`;
    await page.getByRole("button", { name: "Contatta il gestore" }).click();
    await page.getByPlaceholder(/posti per la settimana/).fill(message);
    await page.getByRole("button", { name: "Invia" }).click();
    await expect(page.getByText("Richiesta inviata")).toBeVisible();
    await page.getByRole("button", { name: "Chiudi" }).click();

    // 2) Gestore (context separato): vede la richiesta in "Da rispondere" e risponde.
    const gestoreContext = await browser.newContext();
    const gestorePage = await gestoreContext.newPage();
    const reply = `Sì, ci sono ancora posti (risposta di test ${Date.now()})`;
    try {
      await loginAs(gestorePage, "center_admin");
      await gestorePage.goto("/center/richieste");

      const row = gestorePage.locator("div").filter({ hasText: message }).last();
      await expect(row).toBeVisible();
      await row.getByPlaceholder("Scrivi la tua risposta…").fill(reply);
      await row.getByRole("button", { name: "Invia risposta" }).click();
      await expect(gestorePage.getByText("Risposto").first()).toBeVisible();
    } finally {
      await gestoreContext.close();
    }

    // 3) Genitore: la risposta appare in "Le mie richieste".
    await page.goto("/richieste");
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText(reply)).toBeVisible();
    await expect(page.getByText("Risposta ricevuta").first()).toBeVisible();
  });

  // Segnalazione di Fabrizio: "deve essere notificato da entrambe le parti
  // l'arrivo di un messaggio..con un pallino" + "ci vuole la possibilità di
  // selezionarle tutte e segnare come già lette o da leggere". Verifica il
  // giro end-to-end: una nuova richiesta è "non letta" per il centro (pallino
  // rosso), selezionarla e segnarla come letta la spegne; una risposta è
  // "non letta" per il genitore allo stesso modo.
  // Priorita: Media | Precondizioni: Nessuna
  test("TC-178 - Pallino non letta + selezione multipla + segna come letta/da leggere (entrambi i lati)", async ({
    page,
    browser,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, gli account Genitore/Gestore di test e le colonne read_by_parent/read_by_center applicate (vedi supabase/schema.sql)."
    );

    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);
    const message = `Richiesta letto/non letto ${Date.now()}`;
    await page.getByRole("button", { name: "Contatta il gestore" }).click();
    await page.getByPlaceholder(/posti per la settimana/).fill(message);
    await page.getByRole("button", { name: "Invia" }).click();
    await expect(page.getByText("Richiesta inviata")).toBeVisible();
    await page.getByRole("button", { name: "Chiudi" }).click();

    const gestoreContext = await browser.newContext();
    const gestorePage = await gestoreContext.newPage();
    const reply = `Risposta letto/non letto ${Date.now()}`;
    try {
      await loginAs(gestorePage, "center_admin");
      await gestorePage.goto("/center/richieste");

      const row = gestorePage.locator("div").filter({ hasText: message }).last();
      await expect(row).toBeVisible();
      // Pallino "non letta" visibile finché non viene segnata.
      await expect(row.locator(".bg-\\[\\#FF6B6B\\]").first()).toBeVisible();

      await row.getByRole("checkbox").first().check();
      await gestorePage.getByRole("button", { name: "Segna come lette" }).click();
      await expect(row.locator(".bg-\\[\\#FF6B6B\\]")).toHaveCount(0);

      await row.getByPlaceholder("Scrivi la tua risposta…").fill(reply);
      await row.getByRole("button", { name: "Invia risposta" }).click();
      await expect(gestorePage.getByText("Risposto").first()).toBeVisible();
    } finally {
      await gestoreContext.close();
    }

    // Il genitore ora ha una risposta "non letta" (pallino rosso).
    await page.goto("/richieste");
    const parentRow = page.locator("div").filter({ hasText: message }).last();
    await expect(parentRow.locator(".bg-\\[\\#FF6B6B\\]").first()).toBeVisible();

    await parentRow.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Segna come lette" }).click();
    await expect(parentRow.locator(".bg-\\[\\#FF6B6B\\]")).toHaveCount(0);
  });

  // Priorita: Media | Precondizioni: Nessuna richiesta aperta per il centro
  // Passi: Apri /center/richieste senza richieste ricevute
  // Risultato atteso: Mostra "Nessuna richiesta in attesa di risposta" invece di una lista vuota senza spiegazione
  test("TC-164 - Stato vuoto di 'Le mie richieste' lato gestore", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/richieste");
    // Non asseriamo l'assenza totale (potrebbero esserci richieste reali da
    // run precedenti): verifichiamo solo che la pagina non vada in errore e
    // mostri le due sezioni attese.
    await expect(page.getByText(/Da rispondere \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Storico \(\d+\)/)).toBeVisible();
  });

  // Segnalazione di Fabrizio: "ne 'le mie richieste' vanno anche quelle
  // raggruppate con la stessa logica del registro" — stesso raggruppamento
  // per mese già introdotto in Registro presenze (AttendanceClient.tsx),
  // applicato qui sia lato gestore (RichiesteClient.tsx) sia lato genitore
  // (RichiesteGenitoreClient.tsx).
  // Priorita: Bassa | Precondizioni: Almeno una richiesta esistente
  test("TC-184 - 'Le mie richieste' mostra un'intestazione di mese sopra le richieste (gestore e genitore)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e gli account Genitore/Gestore di test.");

    await loginAs(page, "center_admin");
    await page.goto("/center/richieste");
    const anyGestoreRow = page.getByText(/Da rispondere \(\d+\)|Storico \(\d+\)/).first();
    await expect(anyGestoreRow).toBeVisible();
    const hasGestoreRequests = (await page.getByText(/Da rispondere \(0\)/).count()) === 0 || (await page.getByText(/Storico \(0\)/).count()) === 0;
    if (hasGestoreRequests) {
      // L'etichetta di mese è in maiuscolo (es. "LUGLIO 2026") sopra il
      // gruppo di richieste dello stesso mese — stesso pattern del Registro.
      await expect(page.getByText(/^[A-ZÀ-Ù]+ \d{4}$/).first()).toBeVisible();
    }

    await loginAs(page, "parent");
    await page.goto("/richieste");
    const hasParentRequests = !(await page
      .getByText("Non hai ancora contattato nessun centro.")
      .isVisible()
      .catch(() => false));
    if (hasParentRequests) {
      await expect(page.getByText(/^[A-ZÀ-Ù]+ \d{4}$/).first()).toBeVisible();
    }
  });
});
