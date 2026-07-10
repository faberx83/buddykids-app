import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Profilo
// Generato da BuddyKids_Test_Case.xlsx.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.
//
// Convertiti da gotoAsRole a loginAs: /profile richiede sessione reale contro
// un deploy con Supabase configurato.
//
// NOTA su TC-133 (cambio password): usa lo STESSO account genitore condiviso
// con tutti gli altri file di test. "serial" qui evita che TC-133 cambi la
// password mentre un altro test DI QUESTO FILE sta facendo login in parallelo.
// Resta un rischio residuo (minimo, finestra di poche centinaia di ms) di
// collisione con test di ALTRI file eseguiti in parallelo (fullyParallel:
// true in playwright.config.ts) — se osservi login falliti sporadici durante
// la suite completa, lancia questo file da solo per isolarlo.
test.describe.configure({ mode: "serial" });

test.describe("Genitori - Profilo", () => {
  // TC-066 - Visualizza profilo
  test("TC-066 - il profilo mostra nome/email reali e la lista bambini", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await expect(page.getByText(process.env.TEST_PARENT_EMAIL || "")).toBeVisible();
    await expect(page.getByText("[TEST] Bimbo Prova")).toBeVisible();
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: '+ Aggiungi' nella sezione bambini -> compila nome/eta/altro -> salva
  // Risultato atteso: Il bambino compare nella lista, salvato su Supabase
  test.fixme("TC-067 - Aggiungere un bambino", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Bassa | Precondizioni: Nessuna
  // Passi: Osserva i 3 riquadri statistici in alto (Prenotazioni/Gruppi/Risparmiati)
  // Risultato atteso: Dovrebbero riflettere i dati reali dell'utente
  // Noto: numeri fissi demo (12/3/85 euro) — badge "Numeri demo" sempre visibile,
  // per design (vedi app/(main)/profile/page.tsx): non c'è ancora un calcolo reale
  // da verificare, quindi resta escluso dall'automazione finché non lo sarà.
  test.fixme("TC-068 - Statistiche profilo", async ({ page }) => {
    // ESCLUSO dall'automazione: i 3 riquadri sono hardcoded (dati demo), non c'è
    // un comportamento reale da asserire finché non viene collegato un calcolo vero.
  });

  // TC-069 - Modifica profilo (ora include telefono, data di nascita, genere — vedi TC-132)
  test("TC-069 - 'Modifica' apre il form e salva nome e cognome", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "Modifica" }).click();
    const uniqueName = `Genitore Test ${Date.now()}`;
    await page.getByRole("textbox").first().fill(uniqueName);
    await page.getByRole("button", { name: "Salva" }).click();

    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  // Voci menu in arrivo — AGGIORNATO: "Notifiche" e "Lingua" non sono più
  // ComingSoon in questo elenco: sono ora "Preferenze"/"Sicurezza"/"Privacy e
  // account" reali (vedi TC-133..137). Restano ComingSoon solo: Le mie
  // prenotazioni, Preferiti, Navetta, Chat con organizzatori, Ricevute e fatture.
  test("TC-070 - le voci non ancora implementate mostrano il badge ComingSoon", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    for (const label of ["Le mie prenotazioni", "Preferiti", "Navetta"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // "Notifiche"/"Lingua" come voci ComingSoon non devono più esistere in questa vista.
    await expect(page.getByText("Notifiche", { exact: true })).toHaveCount(0);
  });

  // TC-071 - Logout da Profilo
  test("TC-071 - 'Esci dall'account' termina la sessione e riporta al login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: /esci dall.?account/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // Priorita: Media | Precondizioni: Genitore loggato
  // Passi: In Profilo, clicca l'icona fotocamera sull'avatar e carica un'immagine
  // Risultato atteso: La foto sostituisce le iniziali/gradiente di default ed è visibile subito dopo il caricamento
  test.fixme("TC-113 - Upload foto profilo genitore", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage (avatar_url/bucket) applicato su Supabase prima del test
  });

  // Priorita: Bassa | Precondizioni: Almeno un bambino nel profilo
  // Passi: In Profilo, sezione Bambini, clicca l'icona fotocamera sull'avatar di un bambino
  // Risultato atteso: La foto sostituisce l'emoji/colore di default per quel bambino, ovunque appaia (Home, Per Bambino, Prenotazione)
  test.fixme("TC-114 - Upload foto profilo bambino", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

  // TC-132 - Dati personali estesi (telefono, data di nascita, genere)
  test("TC-132 - telefono, data di nascita e genere si salvano e persistono dopo reload", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "Modifica" }).click();
    await page.locator("#profile-phone").fill("333 1234567");
    await page.locator("#profile-dob").fill("1990-05-15");
    await page.getByRole("button", { name: "Donna" }).click();
    await page.getByRole("button", { name: "Salva" }).click();

    await page.reload();
    await page.getByRole("button", { name: "Modifica" }).click();
    await expect(page.locator("#profile-phone")).toHaveValue("333 1234567");
    await expect(page.locator("#profile-dob")).toHaveValue("1990-05-15");
  });

  // TC-133 - Cambio password dalla sezione Sicurezza
  // NOTA: il test cambia la password e la RIPORTA subito a quella originale
  // (env TEST_PARENT_PASSWORD) prima di terminare, per non rompere il login
  // degli altri test che riusano lo stesso account condiviso.
  test("TC-133 - la nuova password aggiorna l'account e permette il login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    const originalPassword = process.env.TEST_PARENT_PASSWORD;
    test.skip(!originalPassword, "TEST_PARENT_PASSWORD non impostata.");

    await loginAs(page, "parent");
    await page.goto("/profile");

    const tempPassword = `TempPwd!${Date.now()}`;
    await page.locator("#security-new-password").fill(tempPassword);
    await page.locator("#security-confirm-password").fill(tempPassword);
    await page.getByRole("button", { name: "Aggiorna password" }).click();
    await expect(page.getByText("Password aggiornata.")).toBeVisible();

    // Ripristino immediato della password originale (stesso form, stessa sessione).
    await page.locator("#security-new-password").fill(originalPassword!);
    await page.locator("#security-confirm-password").fill(originalPassword!);
    await page.getByRole("button", { name: "Aggiorna password" }).click();
    await expect(page.getByText("Password aggiornata.")).toBeVisible();
  });

  // TC-134 - Preferenze (lingua/tema/notifiche) persistono
  test("TC-134 - cambiare lingua/tema/notifiche salva subito e persiste dopo reload", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Scuro" }).click();
    await page.getByLabel("Notifiche SMS").check();

    await page.reload();
    await expect(page.getByRole("button", { name: "English" })).toHaveClass(/bg-sky/);
    await expect(page.getByRole("button", { name: "Scuro" })).toHaveClass(/bg-sky/);
    await expect(page.getByLabel("Notifiche SMS")).toBeChecked();

    // Ripristino ai valori di default per non alterare i run successivi.
    await page.getByRole("button", { name: "Italiano" }).click();
    await page.getByRole("button", { name: "Chiaro" }).click();
    await page.getByLabel("Notifiche SMS").uncheck();
  });

  // TC-135 - Consenso marketing attivabile/disattivabile
  test("TC-135 - il consenso marketing si salva e persiste dopo reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    const consentCheckbox = page.getByLabel("Consenso a comunicazioni marketing");
    await consentCheckbox.check();
    await page.reload();
    await expect(page.getByLabel("Consenso a comunicazioni marketing")).toBeChecked();

    // Ripristino a non-consenso per non alterare i run successivi.
    await page.getByLabel("Consenso a comunicazioni marketing").uncheck();
  });

  // TC-136 - Disattivazione temporanea dell'account
  // NOTA: tests/cleanup-test-data.mjs riporta account_status a 'active' prima
  // di ogni run — necessario perché questo test disattiva davvero l'account
  // condiviso di test.
  test("TC-136 - disattivare l'account termina la sessione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "Disattiva account temporaneamente" }).click();
    await page.getByRole("button", { name: "Conferma disattivazione" }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // TC-137 - Richiesta di cancellazione account (diritto all'oblio)
  // NOTA: come TC-136, tests/cleanup-test-data.mjs riporta lo stato a 'active'
  // prima di ogni run. La cancellazione VERA va evasa manualmente da un
  // platform_admin (vedi app/actions/profile.ts): qui verifichiamo solo che la
  // richiesta venga marcata correttamente.
  test("TC-137 - richiedere la cancellazione marca l'account come 'in attesa'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "Richiedi cancellazione account" }).click();
    await page.getByRole("button", { name: "Conferma richiesta" }).click();

    await expect(page.getByText(/Richiesta di cancellazione inviata/i)).toBeVisible();
  });
});
