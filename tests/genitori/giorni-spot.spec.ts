import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE Build Sprint 3 — "Giorni spot": selezione di giorni singoli
// (invece della settimana intera) nella scheda attività, con calcolo prezzo
// dinamico e prenotazione dedicata (public.booking_days, migration_12).
//
// Richiede backend reale (login vero, non ruolo demo) E dati seminati da
// supabase/seed-test-data.sql STEP 7 (booking_mode='mixed' + activity_days
// per l'attività di test) — se lo STEP 7 non è stato ancora eseguito, questi
// test si limitano a uno skip esplicito invece di fallire a vuoto o
// inventare un'asserzione su dati che potrebbero non esistere ("never
// overstate proof").

async function gotoTestActivityDetail(page: import("@playwright/test").Page) {
  await page.goto("/search");
  await page.getByPlaceholder("Cerca attività, centri, sport...").fill("[TEST] Attività BuddyKids");
  const card = page.getByText("[TEST] Attività BuddyKids").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "Attività di test non trovata: esegui prima supabase/seed-test-data.sql.");
  }
  await card.click();
}

test.describe("Genitori - Giorni spot", () => {
  test("TC-N500 - Selezione giorni nella scheda attività aggiorna prezzo e link Prenota", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede backend reale (Supabase configurato) — vedi tests/README.md.");
    await loginAs(page, "parent");
    await gotoTestActivityDetail(page);

    const giorniSpotHeading = page.getByText("Giorni spot", { exact: true });
    if (!(await giorniSpotHeading.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Nessuna disponibilità 'Giorni spot' per l'attività di test — esegui STEP 7 di supabase/seed-test-data.sql (richiede migration_11 e migration_12 già applicate)."
      );
    }

    // Prezzo di partenza mostrato in barra inferiore: quello a settimana
    // (nessun giorno ancora selezionato).
    const priceBar = page.locator("text=per settimana").locator("..");
    await expect(priceBar).toContainText("€120");

    // Seleziona il primo giorno disponibile (bottone con "€" nel testo,
    // dentro la sezione Giorni spot) — i bottoni "Pieno" sono disabilitati e
    // non hanno "€" nel testo.
    const dayButtons = page.locator("button", { hasText: "€" });
    const firstDay = dayButtons.first();
    await expect(firstDay).toBeVisible();
    await firstDay.click();

    // Dopo la selezione, la barra inferiore mostra "N giorno/i" invece di
    // "per settimana", e il link "Prenota ora" porta ?days=... in query.
    await expect(page.getByText(/^1 giorno$/)).toBeVisible();
    const prenotaLink = page.getByRole("link", { name: "Prenota ora" });
    const href = await prenotaLink.getAttribute("href");
    expect(href).toMatch(/[?&]days=/);

    // Deselezionando lo stesso giorno si torna al prezzo a settimana.
    await firstDay.click();
    await expect(priceBar).toContainText("€120");
  });

  test("TC-N501 - Prenotazione di giorni singoli arriva a schermata di successo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede backend reale (Supabase configurato) — vedi tests/README.md.");
    await loginAs(page, "parent");
    await gotoTestActivityDetail(page);

    const giorniSpotHeading = page.getByText("Giorni spot", { exact: true });
    if (!(await giorniSpotHeading.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Nessuna disponibilità 'Giorni spot' per l'attività di test — esegui STEP 7 di supabase/seed-test-data.sql."
      );
    }

    const dayButtons = page.locator("button", { hasText: "€" });
    await dayButtons.first().click();

    const prenotaLink = page.getByRole("link", { name: "Prenota ora" });
    await prenotaLink.click();

    // Step 1 di Prenotazione: riepilogo "Giorni scelti" (non la griglia
    // settimane) — poi step 2 (bambino, già preesistente da seed-test-data)
    // e step 3 (pagamento simulato), come il flusso a settimana esistente.
    await expect(page.getByText("Giorni scelti")).toBeVisible();
    await page.getByRole("button", { name: "Continua" }).click();

    await expect(page.getByText("Chi partecipa?")).toBeVisible();
    const kidRow = page.getByText("[TEST] Bimbo Prova");
    if (!(await kidRow.isVisible().catch(() => false))) {
      test.skip(true, "Bambino di test non trovato: esegui STEP 6 di supabase/seed-test-data.sql.");
    }
    await page.getByRole("button", { name: "Continua" }).click();

    // "Pagamento" da solo è ambiguo (compare sia nello StepIndicator sia nel
    // titolo dello step): il sottotitolo è univoco nella pagina.
    await expect(page.getByText("Scegli il metodo di pagamento")).toBeVisible();
    await page.getByRole("button", { name: "Conferma e paga" }).click();

    await page.waitForURL(/\/booking\/.*\/success/);
  });

  // TRAMA — segnalazione Fabrizio 25/08/2026: "Modifica prenotazione... qual
  // è il processo ipotizzato?" per una prenotazione a Giorni spot →
  // decisione esplicita (aggiungi E rimuovi giorni singoli, non solo
  // annulla). Crea una prenotazione a giorni fresca (stesso flusso di
  // TC-N501, così il giorno scelto è sempre nel futuro e sempre fuori dalla
  // finestra di preavviso) poi verifica che "Modifica prenotazione" mostri
  // l'editor interattivo (non più il messaggio "non ancora supportata") e
  // che aggiungere un secondo giorno aggiorni il totale.
  test("TC-N658 - Modifica prenotazione a Giorni spot: editor add/remove aggiorna il totale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede backend reale (Supabase configurato) — vedi tests/README.md.");
    await loginAs(page, "parent");
    await gotoTestActivityDetail(page);

    const giorniSpotHeading = page.getByText("Giorni spot", { exact: true });
    if (!(await giorniSpotHeading.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Nessuna disponibilità 'Giorni spot' per l'attività di test — esegui STEP 7 di supabase/seed-test-data.sql."
      );
    }

    const dayButtons = page.locator("button", { hasText: "€" });
    const availableCount = await dayButtons.count();
    if (availableCount < 2) {
      test.skip(true, "Servono almeno 2 giorni disponibili per testare l'aggiunta — dati di test insufficienti.");
    }
    await dayButtons.first().click();

    const prenotaLink = page.getByRole("link", { name: "Prenota ora" });
    await prenotaLink.click();
    await expect(page.getByText("Giorni scelti")).toBeVisible();
    await page.getByRole("button", { name: "Continua" }).click();

    await expect(page.getByText("Chi partecipa?")).toBeVisible();
    const kidRow = page.getByText("[TEST] Bimbo Prova");
    if (!(await kidRow.isVisible().catch(() => false))) {
      test.skip(true, "Bambino di test non trovato: esegui STEP 6 di supabase/seed-test-data.sql.");
    }
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(page.getByText("Scegli il metodo di pagamento")).toBeVisible();
    await page.getByRole("button", { name: "Conferma e paga" }).click();
    await page.waitForURL(/\/booking\/.*\/success/);

    // Vai a "Le mie prenotazioni" e apri "Modifica" sulla prenotazione appena
    // creata (in cima, essendo la più recente).
    await page.goto("/prenotazioni");
    const modificaLink = page.getByRole("link", { name: "Modifica" }).first();
    await expect(modificaLink).toBeVisible();
    await modificaLink.click();

    // L'editor deve mostrare l'avviso onesto SPARITO (mai più "non ancora
    // supportata") e invece la griglia interattiva con un giorno "Incluso".
    await expect(page.getByText("La modifica delle date non è")).not.toBeVisible();
    await expect(page.getByText("Incluso").first()).toBeVisible();

    // Aggiunge un secondo giorno (un bottone ancora con "€", non "Incluso").
    const addableButtons = page.locator("button", { hasText: "€" });
    if ((await addableButtons.count()) === 0) {
      test.skip(true, "Nessun secondo giorno aggiungibile disponibile in questo ambiente di test.");
    }
    await addableButtons.first().click();
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await page.waitForURL("/prenotazioni");

    // Riapri Modifica e verifica che ora risultino 2 giorni "Incluso".
    await page.goto("/prenotazioni");
    await page.getByRole("link", { name: "Modifica" }).first().click();
    const inclusi = page.getByText("Incluso");
    await expect(inclusi).toHaveCount(2);
  });
});
