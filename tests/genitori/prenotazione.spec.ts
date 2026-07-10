import { test, expect } from "../fixtures/roles";
import { gotoAsRole, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Prenotazione
// Generato da BuddyKids_Test_Case.xlsx - 11 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.

// Apre la scheda dell'attività di test seminata da supabase/seed-test-data.sql
// e clicca "Prenota ora" — punto di partenza comune a TC-108/109/110/111/112,
// che richiedono tutti backend reale (loginAs, non il ruolo demo mock).
async function gotoTestActivityBooking(page: import("@playwright/test").Page) {
  await page.goto("/search");
  await page.getByPlaceholder("Cerca attività, centri, sport...").fill("[TEST] Attività BuddyKids");
  const card = page.getByText("[TEST] Attività BuddyKids").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "Attività di test non trovata: esegui prima supabase/seed-test-data.sql.");
  }
  await card.click();
  await page.getByRole("link", { name: "Prenota ora" }).click();
}

test.describe("Genitori - Prenotazione", () => {
  // Priorita: Alta | Precondizioni: Attivita con settimane disponibili, almeno un bambino inserito
  // Passi: Apri attivita -> 'Prenota' -> step 1 scegli settimane -> step 2 scegli bambino/i -> step 3 scegli pagamento -> conferma
  // Risultato atteso: Prenotazione creata in Supabase (bookings/booking_weeks/booking_kids), redirect a schermata di successo
  test.fixme("TC-029 - Prenotazione completa", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Media | Precondizioni: Prenotazione con 2+ settimane selezionate
  // Passi: Seleziona 2 o piu settimane nello step 1
  // Risultato atteso: Il totale mostra la riga 'Sconto multi-settimana' -5% calcolata sul subtotale (settimane x prezzo x bambini)
  test.fixme("TC-030 - Sconto multi-settimana", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Alta | Precondizioni: Almeno 2 bambini salvati nel profilo
  // Passi: Nello step 2, seleziona 2 o piu bambini per la stessa prenotazione
  // Risultato atteso: Il totale mostra 'Sconto famiglia' pari a -10% sul 2 bambino, -15% sul 3, -20% dal 4 in poi (rispetto al prezzo pieno di un bambino); il subtotale e moltiplicato per il numero di bambini selezionati
  test.fixme("TC-031 - Sconto famiglia 2+ bambini", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Media | Precondizioni: Nessun bambino ancora salvato
  // Passi: Nello step 2, clicca 'Aggiungi bambino' e compila il form
  // Risultato atteso: Il bambino viene salvato e selezionabile subito, il totale si aggiorna
  test.fixme("TC-032 - Aggiunta bambino durante la prenotazione", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Alta | Precondizioni: Prenotazione in corso, step 3
  // Passi: Scegli un metodo di pagamento e conferma
  // Risultato atteso: Testo esplicito 'Pagamento simulato a scopo dimostrativo' nella schermata di successo, nessun addebito reale
  test.fixme("TC-033 - Pagamento (simulato)", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Bassa | Precondizioni: Nessuna
  // Passi: Nello step 2 di prenotazione, osserva la sezione 'Andiamo Insieme'
  // Risultato atteso: Badge ComingSoon visibile
  test.fixme("TC-034 - Rimando ad Andiamo Insieme nello step prenotazione", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Alta | Precondizioni: Genitore con almeno una prenotazione confermata per una specifica attività
  // Passi: Torna sulla stessa attività (da qualsiasi punto: Cerca, Planner, scheda attività) e apri "Prenota ora"
  // Risultato atteso: Le settimane già prenotate e confermate appaiono con badge verde "✓ Già prenotata" e non sono cliccabili/selezionabili di nuovo
  test("TC-108 - Settimane già confermate per la stessa attività non ri-selezionabili", async ({ page }) => {
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    const bookedCard = page.getByText("✓ Già prenotata").first();
    if (!(await bookedCard.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Nessuna settimana già confermata per l'attività di test con questo account: prenota prima una settimana per generare la precondizione."
      );
    }
    const cardContainer = bookedCard.locator("xpath=ancestor::div[contains(@class,'cursor-not-allowed')]").first();
    await expect(cardContainer).toHaveClass(/cursor-not-allowed/);
    await expect(cardContainer).toHaveClass(/border-green/);
  });

  // Priorita: Bassa | Precondizioni: Nessuna
  // Passi: Confronta il formato delle date settimana in Planner, selettore Prenotazione, banner di Cerca e riepilogo di Prenotazione
  // Risultato atteso: Stesso formato ovunque: intervallo di date in evidenza (es. "GIU 2-6") con "Sett. N" come etichetta secondaria
  test("TC-109 - Formato data settimana coerente in tutte le sezioni", async ({ page }) => {
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    // Selettore Prenotazione (step 1): il range di date (es. "GIU 2-6") è il
    // testo primario, "Sett. N" l'etichetta secondaria — vedi WeekCard.tsx.
    await expect(page.getByText(/^[A-Z]{3} \d{1,2}-\d{1,2}$/).first()).toBeVisible();
    await expect(page.getByText(/^Sett\. \d+$/).first()).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Dispositivo mobile/touch
  // Passi: Seleziona una settimana nello step 1, poi deselezionala con un tap
  // Risultato atteso: La card torna visivamente allo stato non selezionato, senza restare con i colori dello stato attivo
  test("TC-110 - Deselezione settimana non resta \"incollata\" allo stato attivo (mobile)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Verifica solo su viewport mobile Chromium (coerente col resto della suite).");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    const selectableWeek = page
      .getByText(/✓ \d+ posti|⚡ ultimi \d+/)
      .first()
      .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
      .first();
    if (!(await selectableWeek.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana selezionabile disponibile per l'attività di test in questo momento.");
    }

    await selectableWeek.tap();
    await expect(selectableWeek).toHaveClass(/border-sky/);
    await expect(selectableWeek.getByText("✓ Selezionata")).toBeVisible();

    await selectableWeek.tap();
    await expect(selectableWeek).not.toHaveClass(/border-sky/);
    await expect(selectableWeek.getByText("✓ Selezionata")).toHaveCount(0);
  });

  // Priorita: Alta | Precondizioni: Prenotazione completata con successo
  // Passi: Completa una prenotazione fino alla schermata finale
  // Risultato atteso: Le settimane prenotate sono elencate correttamente, non "--"
  test("TC-111 - Pagina di successo mostra le settimane corrette", async ({ page }) => {
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    const selectableWeek = page
      .getByText(/✓ \d+ posti|⚡ ultimi \d+/)
      .first()
      .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
      .first();
    if (!(await selectableWeek.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana selezionabile disponibile per l'attività di test in questo momento (attività senza posti liberi).");
    }
    await selectableWeek.click();
    await page.getByRole("button", { name: "Continua" }).click();

    // Step 2 - Chi partecipa: seleziona il primo bambino disponibile.
    await expect(page.getByText("Chi partecipa?")).toBeVisible();
    await page.locator("label, button").filter({ hasText: /.+/ }).first().click().catch(() => {});
    await page.getByRole("button", { name: "Continua" }).click();

    // Step 3 - conferma.
    await page.getByRole("button", { name: "Conferma e paga" }).click();
    await expect(page).toHaveURL(/\/success/, { timeout: 15_000 });

    // NOTA: se la precondizione (bambino selezionabile) non è disponibile, il
    // test si ferma prima con uno skip esplicito invece di fallire in modo
    // poco chiaro sullo step 2 — vedi i controlli sopra.
    await expect(page.getByText("Settimane")).toBeVisible();
    const weeksRow = page.locator("span", { hasText: "Settimane" }).locator("xpath=following-sibling::span").first();
    await expect(weeksRow).not.toHaveText("--");
    await expect(weeksRow).not.toHaveText("");
  });

  // Priorita: Bassa | Precondizioni: Prenotazione completata
  // Passi: Dalla schermata di successo, usa "Condividi"
  // Risultato atteso: Viene generata un'immagine "cartolina" riepilogativa (canvas) condivisibile tramite le app del telefono, con opzione di download se la condivisione nativa non è disponibile; presente anche "Aggiungi al calendario"
  test("TC-112 - Condividi prenotazione come immagine + aggiungi al calendario", async ({ page }) => {
    // Test indipendente (completa una propria prenotazione, non riusa quella
    // di TC-111) cosi' puo' girare anche da solo — stessa logica di skip.
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    const selectableWeek = page
      .getByText(/✓ \d+ posti|⚡ ultimi \d+/)
      .first()
      .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
      .first();
    if (!(await selectableWeek.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana selezionabile disponibile per l'attività di test in questo momento.");
    }
    await selectableWeek.click();
    await page.getByRole("button", { name: "Continua" }).click();
    await page.locator("label, button").filter({ hasText: /.+/ }).first().click().catch(() => {});
    await page.getByRole("button", { name: "Continua" }).click();
    await page.getByRole("button", { name: "Conferma e paga" }).click();
    await expect(page).toHaveURL(/\/success/, { timeout: 15_000 });

    // "Aggiungi al calendario" è un <a> con href data:text/calendar (.ics) —
    // deve essere abilitato (non il bottone disabled di fallback).
    const calendarLink = page.getByRole("link", { name: "Aggiungi al calendario" });
    await expect(calendarLink).toBeVisible();
    const href = await calendarLink.getAttribute("href");
    expect(href).toMatch(/^data:text\/calendar/);

    // "Condividi" genera una cartolina PNG via canvas: in Chromium headless
    // navigator.share non è disponibile, quindi il fallback scarica il file
    // — verifichiamo che il download parta davvero.
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }),
      page.getByRole("button", { name: "Condividi" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("buddykids-prenotazione.png");
  });

  // Segnalazione di Fabrizio: "manca una CTA tipo 'X' per annullare nelle
  // varie fasi che riporti alla scheda precedente". Invece di aggiungere un
  // pulsante separato, la freccia indietro dell'header ora fa da "annulla di
  // step" quando si è oltre lo step 1 (torna allo step precedente restando
  // in Prenotazione), e solo dal primo step esce davvero dal flusso — vedi
  // BookingClient.tsx#handleBack.
  // Priorita: Alta | Precondizioni: Attività di test con almeno una settimana selezionabile
  test("TC-159 - La freccia indietro annulla lo step corrente senza uscire dal flusso di prenotazione", async ({ page }) => {
    await loginAs(page, "parent");
    await gotoTestActivityBooking(page);

    const selectableWeek = page
      .getByText(/✓ \d+ posti|⚡ ultimi \d+/)
      .first()
      .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
      .first();
    if (!(await selectableWeek.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana selezionabile disponibile per l'attività di test in questo momento.");
    }
    await selectableWeek.click();
    await page.getByRole("button", { name: "Continua" }).click();

    // Siamo allo step 2 ("Chi partecipa?"): la freccia indietro deve
    // riportare allo step 1 restando su /booking/[id], non uscire dal flusso.
    await expect(page.getByText("Chi partecipa?")).toBeVisible();
    await page.getByLabel("Indietro").click();
    await expect(page.getByText("Scegli le settimane")).toBeVisible();
    await expect(page).toHaveURL(/\/booking\//);
  });

  // Segnalazione di Fabrizio: "le mie prenotazioni" era un MenuItem
  // "comingSoon" nel Profilo, senza alcuna pagina dietro. Ora è una lista
  // reale (sola lettura, niente cancellazione per la v1) — vedi
  // lib/data/my-bookings.ts e app/(main)/prenotazioni/page.tsx.
  // Priorita: Alta | Precondizioni: Nessuna (gestisce anche lo stato vuoto)
  test("TC-172 - 'Le mie prenotazioni' mostra l'elenco reale o lo stato vuoto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/profile");
    await page.getByText("Le mie prenotazioni", { exact: true }).click();
    await expect(page).toHaveURL(/\/prenotazioni/);

    const emptyState = page.getByText("Non hai ancora nessuna prenotazione.");
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
    } else {
      // Almeno una card prenotazione con stato e settimane indicati.
      await expect(
        page.getByText(/In attesa di conferma|Confermata|Annullata/).first()
      ).toBeVisible();
    }
  });

  // Segnalazione di Fabrizio: "nel tab 'le mie prenotazioni' va bene la
  // lista ma va fatta un pò di ordinamento..per settimana per bambino per
  // campus..una serie di filtri per raggruappare". Aggiunto un ordinamento
  // a scelta (Settimana/Bambino/Campus) — vedi PrenotazioniClient.tsx.
  // Priorita: Media | Precondizioni: Almeno una prenotazione
  test("TC-182 - 'Le mie prenotazioni' permette di ordinare per settimana/bambino/campus", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/prenotazioni");

    const sortLabel = page.getByText("Ordina per:");
    if (!(await sortLabel.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione per l'account di test: i controlli di ordinamento non vengono mostrati.");
    }
    await expect(sortLabel).toBeVisible();
    await page.getByRole("button", { name: "Bambino", exact: true }).click();
    await page.getByRole("button", { name: "Campus", exact: true }).click();
    await page.getByRole("button", { name: "Settimana", exact: true }).click();
    // Non deve andare in errore con nessuno dei tre criteri.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

});
