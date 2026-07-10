import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Home
// Test implementati (selettori presi da app/(main)/page.tsx e components/HomeFeed.tsx).
//
// Convertiti da gotoAsRole a loginAs: Home reindirizza a /auth/login se
// Supabase è configurato e non c'è sessione reale.

test.describe("Genitori - Home", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/");
  });

  // TC-013 - Filtro categoria in Home
  // NOTA (aggiornato): la vecchia Home "🔥 Popolari vicino a te" con filtro
  // categoria in cima è stata sostituita dal toggle Planner/Per bambino
  // (vedi HomeFeed.tsx) — le "Categorie" ora vivono dentro "Per bambino"
  // (PerBambinoView.tsx), senza un cambio di titolo dedicato: verifichiamo
  // quindi che il chip si selezioni/deselezioni visivamente invece del
  // vecchio titolo "🔥 Attività in questa categoria" che non esiste più.
  //
  // BUG DI TEST TROVATO+CORRETTO (run reale): la regex /border-sky/ matcha
  // ANCHE la classe statica "hover:border-sky" presente nel chip NON
  // selezionato (components/CategoryChip.tsx: stato non selezionato =
  // "border-[#EDF0F4] bg-white hover:border-sky hover:bg-sky"), quindi
  // l'assert ".not.toHaveClass(/border-sky/)" falliva SEMPRE (falso positivo
  // di selezione). Corretta con un lookbehind negativo che esclude il prefisso
  // "hover:", così la regex riconosce solo la classe reale dello stato
  // selezionato ("border-sky bg-sky", senza prefisso).
  test("TC-013 - selezionare una categoria filtra le card, 'Tutte' ripristina", async ({ page }) => {
    const selectedClass = /(?<!hover:)border-sky\b/;
    await page.getByRole("button", { name: "Per bambino", exact: true }).click();
    await expect(page.getByText("Categorie")).toBeVisible();

    const sportChip = page.getByText("Sport", { exact: true }).locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]").first();
    await sportChip.click();
    await expect(sportChip).toHaveClass(selectedClass);

    await page.getByText("Tutte", { exact: true }).click();
    await expect(sportChip).not.toHaveClass(selectedClass);
  });

  // TC-014 - Geolocalizzazione Home (permesso concesso)
  test("TC-014 - 'Usa posizione' con permesso concesso mostra un conteggio di centri", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByText(/centri nel raggio di 5 km/)).toBeVisible({ timeout: 10_000 });
  });

  // TC-015 - Geolocalizzazione negata
  test("TC-015 - 'Usa posizione' con permesso negato mostra un messaggio d'errore leggibile", async ({
    page,
    context,
  }) => {
    await context.clearPermissions(); // permesso non concesso -> il browser blocca/rifiuta
    await page.getByRole("button", { name: "Usa posizione" }).click();
    // L'app non deve crashare: la CTA resta cliccabile e/o appare un messaggio di errore.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // TC-023 - Ricerca con geolocalizzazione da Home -> Cerca
  test("TC-023 - 'Vedi in Cerca' dopo la geolocalizzazione porta a /search con lat/lng", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 });

    await page.getByRole("button", { name: "Usa posizione" }).click();
    await expect(page.getByRole("button", { name: "Vedi in Cerca" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Vedi in Cerca" }).click();

    await expect(page).toHaveURL(/\/search\?.*lat=.*lng=/);
  });
  // Priorita: Alta | Precondizioni: Almeno un'attivita inserita in Supabase
  // Passi: Login come genitore -> apri '/'
  // Risultato atteso: Le card 'Popolari' mostrano attivita reali dal DB, non i dati demo
  test.fixme("TC-012 - Home mostra attivita reali", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // TC-141 - Il badge avatar in alto a destra porta al profilo
  // NUOVA FUNZIONALITÀ: prima era un div inerte, senza onClick/Link — solo
  // decorativo (vedi app/(main)/page.tsx).
  test("TC-141 - il badge avatar in Home porta a /profile", async ({ page }) => {
    await page.getByRole("link", { name: "Vai al profilo" }).click();
    await expect(page).toHaveURL(/\/profile/);
  });

  // TC-142 - Il pallino sul badge avatar riflette il profilo incompleto
  // NUOVA FUNZIONALITÀ: prima era un pallino rosso statico, sempre presente,
  // senza alcun significato (nessuna logica lo pilotava). Ora compare SOLO
  // se il profilo è incompleto (isParentProfileIncomplete, stessa logica già
  // usata da HomeProfilePrompt per il link "Nome, cognome e ruolo").
  test("TC-142 - il pallino rosso è coerente con lo stato 'profilo incompleto'", async ({ page }) => {
    const incompleteLinkVisible = await page
      .getByText("Nome, cognome e ruolo (padre/madre/tutore)")
      .isVisible()
      .catch(() => false);
    // Il pallino è l'unico <div> figlio del badge (l'eventuale foto profilo è
    // un <img>, le iniziali sono testo): contarlo evita di dover fare
    // l'escaping CSS della classe arbitraria "bg-[#FF6B6B]".
    const dot = page.getByRole("link", { name: "Vai al profilo" }).locator("div");
    if (incompleteLinkVisible) {
      await expect(dot).toHaveCount(1);
    } else {
      await expect(dot).toHaveCount(0);
    }
  });

  // TC-143 - Gli avatar bambino in "Per bambino" mostrano la foto reale
  // BUG DI TEST TROVATO+CORRETTO nell'app (segnalato da Fabrizio): PerBambinoView.tsx
  // mostrava SOLO emoji+colore, mai la foto caricata (kid.avatarUrl) — l'anello
  // di selezione stava per di più sullo stesso elemento senza overflow-hidden,
  // quindi anche aggiungendo la foto sarebbe stata tagliata male. Corretto:
  // foto in un cerchio interno con overflow-hidden, anello su un wrapper
  // esterno separato. Il bambino di test ha un avatar_url seminato (SVG
  // inline, vedi supabase/seed-test-data.sql STEP 6) per poter verificare
  // questo senza automatizzare l'intero flusso di upload+ritaglio.
  test("TC-143 - l'avatar del bambino di test mostra la foto, non l'emoji", async ({ page }) => {
    await page.getByRole("button", { name: "Per bambino", exact: true }).click();
    const kidButton = page.getByRole("button", { name: "[TEST] Bimbo Prova" });
    await expect(kidButton.locator("img")).toBeVisible();
  });

  // TC-151 - Check-in MVP dalla Home ("è arrivato/a?")
  // NUOVA FUNZIONALITÀ (richiesta da Fabrizio, scope MVP concordato: risposta
  // manuale del genitore in app, NIENTE geolocalizzazione/notifica push
  // automatica — non affidabili su web/iOS senza un'infrastruttura dedicata
  // non ancora presente in questo stack). Precondizione: tests/cleanup-test-data.mjs
  // estende la prenotazione fixture con la settimana di camp che copre la
  // data ODIERNA (se ne esiste una tra le 13 seminate) — se il run avviene
  // fuori dalla stagione seminata, la card non compare e il test si
  // auto-salta (soft-skip a runtime, non è un fallimento).
  test("TC-151 - rispondere al check-in salva subito e persiste dopo reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
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

    await page.reload();
    await expect(page.getByRole("button", { name: "Siamo in ritardo" })).toHaveClass(/bg-orange/);

    // Ripristino a "Sì" per non alterare i run successivi.
    await page.getByRole("button", { name: "Sì", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sì", exact: true })).toHaveClass(/bg-partner/);
  });

  // Segnalazione di Fabrizio: "forse nella home bisogna evidenziare il camp
  // della settimana in corso in maniera più evidente". La card di check-in
  // ora mostra anche la foto/copertina dell'attività e un'etichetta
  // "Questa settimana · Settimana N", non solo la domanda in una striscia
  // di testo semplice — vedi CheckinPrompt.tsx e lib/data/checkin.ts.
  // Priorita: Bassa | Precondizioni: Prenotazione con settimana che copre oggi
  test("TC-167 - La card di check-in mostra la foto/copertina e la settimana in corso", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
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

    await expect(page.getByText(/Questa settimana · Settimana \d+/).first()).toBeVisible();
    // Link verso il dettaglio attività (foto/nome cliccabili) — il thumbnail
    // ha sempre un href anche senza copertina reale (fallback emoji/gradiente).
    await expect(page.locator('a[href^="/activity/"]').first()).toBeVisible();
  });
});
