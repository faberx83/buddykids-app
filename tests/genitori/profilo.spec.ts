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

  // Voci menu in arrivo — AGGIORNATO ANCORA: "Le mie prenotazioni" e
  // "Preferiti" sono ora reali (v1, richiesta da Fabrizio) — vedi TC-172/173.
  // "Notifiche" non è più una voce separata: è stata unita dentro
  // "Preferenze" (Fabrizio: "le notifiche le metterei dentro le
  // preferenze"). Restano ComingSoon: Navetta, Ricevute e fatture, Metodi di
  // pagamento.
  test("TC-070 - le voci non ancora implementate mostrano il badge ComingSoon", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    for (const label of ["Navetta", "Metodi di pagamento", "Ricevute e fatture"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // "Le mie prenotazioni" e "Preferiti" sono link reali, non più ComingSoon.
    await expect(page.getByRole("link", { name: /Le mie prenotazioni/ })).toHaveAttribute("href", "/prenotazioni");
    await expect(page.getByRole("link", { name: /Preferiti/ })).toHaveAttribute("href", "/preferiti");
    // "Notifiche" non è più una riga a sé: "Preferenze" ora la include.
    await expect(page.getByRole("link", { name: "Notifiche", exact: true })).toHaveCount(0);
    await expect(page.getByText("Lingua, tema, notifiche")).toBeVisible();
  });

  // TC-148 - Le voci del menu "Impostazioni" aprono ciascuna la propria sotto-pagina
  // NUOVA FUNZIONALITÀ: prima tutte le sottosezioni erano visibili in linea
  // sulla stessa pagina /profile; ora ogni voce (Sicurezza/Preferenze/
  // Notifiche/Privacy e account) è una riga di menu che apre una sotto-pagina
  // dedicata, con back-button (PageHeader) verso /profile — richiesto da
  // Fabrizio ("io farei una sezione dedicata, non tutti i sottomenu visibili").
  test("TC-148 - le voci di Impostazioni aprono le sotto-pagine e il back-button riporta a /profile", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("link", { name: /Sicurezza/ }).click();
    await expect(page).toHaveURL(/\/profile\/sicurezza/);
    await expect(page.locator("#security-new-password")).toBeVisible();

    await page.getByRole("button", { name: "Indietro" }).click(); // back-button (PageHeader)
    await expect(page).toHaveURL(/\/profile$/);
  });

  // TC-150 - Il menu "Scatta foto"/"Scegli dalla galleria" resta nel viewport
  // BUG DI TEST TROVATO+CORRETTO (segnalato da Fabrizio con screenshot): il
  // dropdown in AvatarUploadButton.tsx non aveva left/right espliciti, quindi
  // la sua "static position" orizzontale poteva farlo sporgere/tagliarsi sul
  // bordo della card. Corretto con "left-0" esplicito (vedi componente). Qui
  // verifichiamo che il riquadro del menu resti interamente entro i confini
  // orizzontali del viewport mobile (boundingBox: coordinate di LAYOUT, non
  // rilevano il ritaglio visivo di un overflow-hidden ancestor, ma
  // catturano esattamente la regressione di posizionamento corretta qui).
  test("TC-150 - il menu foto resta interamente nel viewport", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await page.setViewportSize({ width: 375, height: 700 });
    await loginAs(page, "parent");
    await page.goto("/profile");

    // .first(): sia l'avatar del genitore sia quello di ogni bambino (sotto,
    // in ProfileKidsSection) usano lo stesso AvatarUploadButton/aria-label —
    // qui interessa solo il primo (quello del genitore, in alto).
    await page.getByRole("button", { name: "Cambia foto" }).first().click();
    const menu = page.getByText("Scegli dalla galleria").locator("..");
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });

  // Segnalazione di Fabrizio: "nelle foto profilo deve essere possibile
  // modificare anche la foto già caricata..zoom e centratura principalmente".
  // Prima ImageCropModal si apriva solo scegliendo un file nuovo; ora un
  // menu "Modifica ritaglio" lo riapre partendo dalla foto già caricata
  // (URL remoto invece di un File) — vedi AvatarUploadButton.tsx.
  // Priorita: Media | Precondizioni: Genitore con una foto profilo già caricata (vedi TC-113)
  test("TC-171 - 'Modifica ritaglio' riapre il crop sulla foto già caricata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e una foto profilo già caricata.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await page.getByRole("button", { name: "Cambia foto" }).first().click();
    const modificaRitaglio = page.getByRole("button", { name: "Modifica ritaglio" });
    if (!(await modificaRitaglio.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna foto profilo già caricata per l'account di test in questo momento.");
    }
    await modificaRitaglio.click();
    await expect(page.getByText("Centra e ritaglia la foto")).toBeVisible();
    await page.getByRole("button", { name: "Annulla" }).click();
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
  // AGGIORNATO: "Sicurezza" è ora una sotto-pagina dedicata (/profile/sicurezza),
  // non più una sezione inline su /profile (vedi TC-148).
  test("TC-133 - la nuova password aggiorna l'account e permette il login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    const originalPassword = process.env.TEST_PARENT_PASSWORD;
    test.skip(!originalPassword, "TEST_PARENT_PASSWORD non impostata.");

    await loginAs(page, "parent");
    await page.goto("/profile/sicurezza");

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

  // TC-134 - Preferenze (lingua/tema) persistono
  // AGGIORNATO: "Preferenze" è ora una sotto-pagina dedicata (/profile/preferenze),
  // separata da "Notifiche" (vedi TC-147) — prima erano sulla stessa pagina.
  test("TC-134 - cambiare lingua/tema salva subito e persiste dopo reload", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile/preferenze");

    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Scuro" }).click();

    await page.reload();
    await expect(page.getByRole("button", { name: "English" })).toHaveClass(/bg-sky/);
    await expect(page.getByRole("button", { name: "Scuro" })).toHaveClass(/bg-sky/);

    // Ripristino ai valori di default per non alterare i run successivi.
    await page.getByRole("button", { name: "Italiano" }).click();
    await page.getByRole("button", { name: "Chiaro" }).click();
  });

  // TC-147 - Notifiche (email/push/SMS) persistono
  // AGGIORNATO ANCORA: /profile/notifiche ora fa redirect() a
  // /profile/preferenze (le notifiche sono state unite li dentro, richiesta
  // di Fabrizio) — il test resta invariato perché il redirect è trasparente
  // e i toggle sono gli stessi (ProfileNotificheSection -> ora dentro
  // ProfilePreferencesSection).
  test("TC-147 - attivare 'Notifiche SMS' salva subito e persiste dopo reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile/notifiche");
    await expect(page).toHaveURL(/\/profile\/preferenze/);

    await page.getByLabel("Notifiche SMS").check();
    await page.reload();
    await expect(page.getByLabel("Notifiche SMS")).toBeChecked();

    // Ripristino ai valori di default per non alterare i run successivi.
    await page.getByLabel("Notifiche SMS").uncheck();
  });

  // Segnalazione di Fabrizio: "le preferenze lingua/tema non fanno alcuna
  // modifica" — restano salvabili (si scrivono davvero nel profilo) ma ora
  // mostrano un badge "Non ancora attivo" per essere espliciti che non
  // cambiano ancora nulla a video (nessuna traduzione/tema scuro reali).
  // Priorita: Bassa | Precondizioni: Nessuna
  test("TC-174 - Lingua e Tema mostrano il badge 'Non ancora attivo' in Preferenze", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile/preferenze");

    const badges = page.getByText("Non ancora attivo");
    await expect(badges).toHaveCount(2); // una per Lingua, una per Tema
  });

  // TC-135 - Consenso marketing attivabile/disattivabile
  // AGGIORNATO: "Privacy e account" è ora una sotto-pagina dedicata (/profile/privacy).
  test("TC-135 - il consenso marketing si salva e persiste dopo reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile/privacy");

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
    await page.goto("/profile/privacy");

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
    await page.goto("/profile/privacy");

    await page.getByRole("button", { name: "Richiedi cancellazione account" }).click();
    await page.getByRole("button", { name: "Conferma richiesta" }).click();

    await expect(page.getByText(/Richiesta di cancellazione inviata/i)).toBeVisible();
  });

  // TC-221 - "Le presenze" ha una sezione a sé, separata da "Attività"
  // Segnalazione di Fabrizio ("le presenze non ha senso nelle prenotazioni,
  // nel nuovo tab specifico"): la voce non va messa insieme a Le mie
  // prenotazioni/Preferiti/Navetta ma in una sezione dedicata — vedi
  // app/(main)/profile/page.tsx e app/(main)/presenze/page.tsx.
  test("TC-221 - 'Le presenze' e' una sezione a se in Profilo e porta a /presenze", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");

    await expect(page.getByText("Presenze", { exact: true })).toBeVisible();
    await expect(page.getByText("Le presenze")).toBeVisible();

    await page.getByText("Le presenze").click();
    await expect(page).toHaveURL(/\/presenze/);
    await expect(page.getByRole("heading", { name: "Le presenze" })).toBeVisible();
  });
});
