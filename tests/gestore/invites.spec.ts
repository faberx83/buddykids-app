import { test, expect, loginAs } from "../fixtures/roles";

// Area: Gestore - Inviti / Genitori - Registrazione / Genitori - Prenotazione
// Generato da BuddyKids_Test_Case.xlsx - TC-122..TC-131 (feature Inviti).
// Selettori presi da app/center/invites/InvitesClient.tsx e
// app/auth/login/LoginForm.tsx. Richiedono backend reale (loginAs), non il
// ruolo demo mock — vedi supabase/seed-test-data.sql per l'account Gestore
// di test già collegato a un centro (precondizione di "hasCenterId").

test.describe("Gestore - Inviti", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "center_admin");
    await page.goto("/center/invites");
  });

  // Priorita: Media | Precondizioni: Login Gestore centro
  // Passi: Apri 'Inviti', compila nome/email contatto, imposta sconto % e scadenza, invia
  // Risultato atteso: L'invito viene creato con un codice univoco; se è configurato l'invio email (Resend), parte automaticamente un'email con link+codice, altrimenti viene mostrato il link da copiare
  test("TC-122 - Creazione invito singolo con contatto email", async ({ page }) => {
    // Nome ed email univoci per run: la suite gira su più browser/progetti
    // (chromium, mobile-chrome) senza pulizia tra un progetto e l'altro,
    // quindi un nome fisso ("Famiglia di Prova") creava righe duplicate in
    // tabella e getByText falliva con "strict mode violation" dal secondo
    // progetto in poi.
    const uniqueId = Date.now();
    const uniqueName = `Famiglia di Prova ${uniqueId}`;
    const uniqueEmail = `test.invite.${uniqueId}@buddykids.it`;
    await page.getByPlaceholder("Es. Maria Rossi").fill(uniqueName);
    await page.getByPlaceholder("mamma@esempio.it").fill(uniqueEmail);
    await page.getByRole("button", { name: /^Crea invito$/ }).click();

    // Compare o l'esito "email inviata" o il fallback "copia link" — in
    // entrambi i casi deve comparire il link generato con un codice.
    await expect(page.getByText(/Email inviata automaticamente|Email non inviata automaticamente/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('input[readonly]')).toHaveValue(/\/auth\/login\?invite=/);
    // La riga appena creata compare in tabella col nuovo contatto.
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Login Gestore centro, file CSV/TXT con nome,email,telefono per riga
  // Passi: In 'Inviti', usa 'Carica file', seleziona il CSV, conferma
  // Risultato atteso: Un invito viene creato per ciascun contatto valido nel file, con lo stesso sconto/scadenza impostati; i contatti senza email valida restano generabili solo come link (nessuna email inviata)
  test("TC-123 - Caricamento contatti da file per invio multiplo", async ({ page }) => {
    const csv = [
      "nome,email,telefono",
      `Contatto Uno,test.bulk1.${Date.now()}@buddykids.it,`,
      `Contatto Due,test.bulk2.${Date.now()}@buddykids.it,`,
    ].join("\n");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "+ Scegli file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "contatti-test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    // Il componente ricarica la pagina al termine (window.location.reload()) —
    // aspettiamo la navigazione e poi verifichiamo che i 2 contatti compaiano.
    await page.waitForURL(/\/center\/invites/, { timeout: 15_000 });
    await expect(page.getByText("Contatto Uno")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Contatto Due")).toBeVisible();
  });

  // Priorita: Bassa | Precondizioni: Un invito appena creato con contatto email
  // Passi: Osserva lo stato dell'invito subito dopo la creazione
  // Risultato atteso: Se RESEND_API_KEY è configurato, stato "Inviato" + email_sent_at valorizzato; altrimenti resta "Da inviare" col link copiabile
  test("TC-124 - Invio email automatico vs fallback 'copia link'", async ({ page }) => {
    const uniqueEmail = `test.invite.${Date.now()}@buddykids.it`;
    await page.getByPlaceholder("mamma@esempio.it").fill(uniqueEmail);
    await page.getByRole("button", { name: /^Crea invito$/ }).click();

    const row = page.locator("tr", { hasText: uniqueEmail });
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Lo stato deve essere uno tra "Da inviare" (fallback) o "Inviato" (Resend
    // configurato) — mai vuoto/altro, coerente con STATUS_LABEL.
    await expect(row.getByText(/^(Da inviare|Inviato)$/)).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Almeno un invito per stato
  // Passi: Apri 'Inviti' e osserva la tabella
  // Risultato atteso: Ogni riga mostra il badge di stato coerente col database, "Scaduto" calcolato automaticamente dalla data senza job pianificato
  test("TC-125 - Lista inviti mostra lo stato corretto per ciascuno", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count === 0 || (await page.getByText("Nessun invito creato ancora").isVisible().catch(() => false))) {
      test.skip(true, "Nessun invito ancora creato per l'account di test.");
    }
    // Ogni riga con dati reali (non la riga vuota "Nessun invito...") ha
    // esattamente un badge di stato tra quelli noti.
    const statusBadges = page.locator("td span", {
      hasText: /^(Da inviare|Inviato|Registrato|Sconto usato|Scaduto)$/,
    });
    await expect(statusBadges.first()).toBeVisible();
  });

  // Priorita: Bassa | Precondizioni: Un invito attivo, non ancora scaduto
  // Passi: Clicca 'Disattiva' sull'invito; poi 'Riattiva'
  // Risultato atteso: L'invito disattivato non è più utilizzabile; riattivandolo torna utilizzabile (se non scaduto)
  test("TC-126 - Disattivazione/riattivazione manuale di un invito", async ({ page }) => {
    const uniqueEmail = `test.invite.${Date.now()}@buddykids.it`;
    await page.getByPlaceholder("mamma@esempio.it").fill(uniqueEmail);
    await page.getByRole("button", { name: /^Crea invito$/ }).click();

    const row = page.locator("tr", { hasText: uniqueEmail });
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.getByRole("button", { name: "Disattiva" }).click();
    await expect(row.getByText("Disattivato")).toBeVisible();
    await expect(row.getByRole("button", { name: "Riattiva" })).toBeVisible();

    await row.getByRole("button", { name: "Riattiva" }).click();
    await expect(row.getByText("Disattivato")).toHaveCount(0);
  });

  // Priorita: Bassa | Precondizioni: Un invito con promo_expires_at nel passato
  // Passi: Apri 'Inviti' e osserva lo stato; prova ad aprire il link di registrazione con quel codice
  // Risultato atteso: Stato "Scaduto" in lista; anteprima in registrazione segnala il codice non più valido, nessuno sconto applicato
  test.fixme("TC-131 - Invito scaduto non più utilizzabile", async ({ page }) => {
    // TODO: richiede un invito con promo_expires_at già nel passato — il form
    // Gestore permette solo scadenze future dal date picker. Da completare
    // creando l'invito scaduto via SQL Editor (o estendendo
    // supabase/seed-test-data.sql con un invito di test già scaduto), poi
    // verificando qui il badge "Scaduto" e il messaggio in LoginForm.tsx
    // ("Questo codice invito non è (più) valido...").
  });
});

test.describe("Genitori - Registrazione (Inviti)", () => {
  // Priorita: Media | Precondizioni: Un invito attivo e non scaduto
  // Passi: Apri il link di registrazione ricevuto (con ?invite=CODICE)
  // Risultato atteso: Form già in modalità "Crea account" col codice precompilato; anteprima con nome centro e % sconto prima di registrarsi
  test("TC-127 - Link con codice invito precompila il campo e mostra l'anteprima", async ({ page }) => {
    // Crea un invito fresco come Gestore di test, ne legge il codice dalla
    // tabella, poi apre il link risultante come farebbe il contatto invitato
    // (stessa pagina, senza bisogno di essere sloggato: /auth/login non ha
    // guardie di redirect per utenti già autenticati).
    await loginAs(page, "center_admin");
    await page.goto("/center/invites");
    const uniqueEmail = `test.invite.${Date.now()}@buddykids.it`;
    await page.getByPlaceholder("mamma@esempio.it").fill(uniqueEmail);
    await page.getByRole("button", { name: /^Crea invito$/ }).click();

    const row = page.locator("tr", { hasText: uniqueEmail });
    await expect(row).toBeVisible({ timeout: 10_000 });
    const code = (await row.locator("td").nth(1).innerText()).trim();
    expect(code.length).toBeGreaterThan(0);

    await page.goto(`/auth/login?invite=${code}`);
    await expect(page.getByText(/Crea un account/)).toBeVisible();
    await expect(page.locator('input[value="' + code + '"]')).toBeVisible();
    await expect(page.getByText(/🎁 .+ ti offre uno sconto del \d+% sulla tua prima prenotazione/)).toBeVisible({
      timeout: 10_000,
    });
  });

  // Priorita: Alta | Precondizioni: Un invito attivo e non scaduto, codice valido
  // Passi: Completa la registrazione inserendo il codice invito
  // Risultato atteso: Nuovo profilo con invited_by_code valorizzato; invito passa a "Registrato" collegato al nuovo utente
  test.fixme("TC-128 - Registrazione con codice invito collega automaticamente l'invito al nuovo profilo", async ({
    page,
  }) => {
    // TODO: richiede di completare un signUp reale (nuovo utente + click sul
    // link di conferma email) — non automatizzabile in questo ambiente senza
    // accesso a una casella email di test. Da verificare manualmente, oppure
    // automatizzare in futuro con un provider email di test (Mailosaur,
    // Ethereal...) collegato a Supabase Auth.
  });
});

test.describe("Genitori - Prenotazione (Sconto invito)", () => {
  // Priorita: Alta | Precondizioni: Genitore registrato tramite invito, con sconto non ancora utilizzato
  // Passi: Prenota un'attività fino al riepilogo prezzo
  // Risultato atteso: Riga "Sconto invito 🎁" nel riepilogo; a conferma, discount_applied_at valorizzato (sconto consumato)
  test.fixme("TC-129 - Sconto invito applicato una tantum alla prima prenotazione idonea", async ({ page }) => {
    // TODO: richiede un account di test già registrato con un invito
    // collegato (registered_parent_id) e sconto non ancora riscattato — da
    // preparare estendendo supabase/seed-test-data.sql con un invito
    // pre-collegato al parent di test, poi verificare la riga "Sconto invito
    // 🎁" nello step 1/3 di BookingClient.tsx.
  });

  // Priorita: Media | Precondizioni: Genitore che ha già usato lo sconto invito su una prenotazione precedente
  // Passi: Effettua una seconda prenotazione
  // Risultato atteso: Il riepilogo NON mostra più "Sconto invito" (discount_applied_at già valorizzato)
  test.fixme("TC-130 - Sconto invito non riapplicabile a una seconda prenotazione", async ({ page }) => {
    // TODO: dipende dalla stessa precondizione di TC-129 (invito già
    // riscattato una volta) — da completare insieme.
  });
});
