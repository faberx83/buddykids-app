import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Attivita
// Convertiti da gotoAsRole a loginAs (Home/dettaglio richiedono sessione
// reale contro un deploy con Supabase configurato). Attività seminata da
// supabase/seed-test-data.sql, slug usato direttamente come "id" di rotta.
const TEST_ACTIVITY_SLUG = "attivita-test-buddykids";

// "serial": TC-026 e TC-173 leggono/scrivono lo stesso stato preferito
// condiviso sull'attività di test — con l'esecuzione parallela di default
// potrebbero sovrascriversi a vicenda in modo intermittente (stesso
// principio già applicato in tests/gestore/attendance.spec.ts).
test.describe.configure({ mode: "serial" });

test.describe("Genitori - Attivita", () => {
  // TC-025 - Apertura scheda attivita
  test("TC-025 - aprire una card da Home porta al dettaglio con dati reali", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    // Passiamo da Cerca invece che dal feed "Popolari" di Home: quel feed è
    // curato per rating/recensioni e non garantisce di mostrare l'attività
    // di test — Cerca la trova sempre, stesso componente ActivityCard/link
    // di dettaglio usato da Home.
    await page.goto("/search");
    await page.getByPlaceholder("Cerca attività, centri, sport...").fill("[TEST] Attività BuddyKids");
    await page.getByText("[TEST] Attività BuddyKids").first().click();

    await expect(page).toHaveURL(new RegExp(`/activity/${TEST_ACTIVITY_SLUG}`));
    await expect(page.getByText("Servizi disponibili")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prenota ora" })).toBeVisible();
  });

  // TC-026 - Preferiti (cuore) - ORA PERSISTE DAVVERO (era FUNCTIONAL-TC-026).
  // Prima app/activity/[id]/DetailClient.tsx inizializzava "fav" con
  // useState(true) fisso: il cuore tornava sempre pieno dopo reload,
  // indipendentemente dai click. Corretto con una tabella dedicata
  // (supabase/schema.sql#favorites, vedi lib/data/favorites.ts,
  // app/actions/favorites.ts): il click salva/rimuove davvero e lo stato
  // iniziale ora riflette il database, non più un valore hardcoded.
  test("TC-026 - il click sul preferito persiste davvero dopo reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);

    const heart = page.locator(".ti-heart, .ti-heart-filled").first();
    const wasFavorited = (await page.locator(".ti-heart-filled").count()) > 0;

    await heart.click();
    if (wasFavorited) {
      await expect(page.locator(".ti-heart").first()).toHaveCount(1);
    } else {
      await expect(page.locator(".ti-heart-filled").first()).toHaveCount(1);
    }

    await page.reload();
    if (wasFavorited) {
      await expect(page.locator(".ti-heart").first()).toHaveCount(1);
    } else {
      await expect(page.locator(".ti-heart-filled").first()).toHaveCount(1);
    }

    // Ripristino allo stato di partenza per non alterare i run successivi.
    await page.locator(".ti-heart, .ti-heart-filled").first().click();
  });

  // Priorita: Media | Precondizioni: Almeno un'attività salvata nei Preferiti (vedi TC-026)
  // Passi: Salva un'attività dal cuore, poi apri Profilo -> Preferiti
  // Risultato atteso: L'attività salvata compare nella lista "Preferiti"; se nessuna attività è salvata, mostra lo stato vuoto invece di una lista bianca
  test("TC-173 - 'Preferiti' nel profilo elenca le attività salvate", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);

    // Ci assicuriamo che l'attività di test sia tra i preferiti (click solo
    // se non lo è già), per rendere il test indipendente dallo stato lasciato
    // da TC-026.
    const isFavorited = (await page.locator(".ti-heart-filled").count()) > 0;
    if (!isFavorited) {
      await page.locator(".ti-heart, .ti-heart-filled").first().click();
      await expect(page.locator(".ti-heart-filled").first()).toHaveCount(1);
    }

    await page.goto("/preferiti");
    await expect(page.getByText("[TEST] Attività BuddyKids").first()).toBeVisible();
  });
  // Priorita: Media | Precondizioni: Attivita con prenotazioni concluse
  // Passi: Apri il dettaglio di un'attivita
  // Risultato atteso: Ci si aspetta di vedere eventuali recensioni reali dei genitori
  test.fixme("TC-027 - Recensioni", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Il gestore ha creato una promozione attiva
  // Passi: Apri il dettaglio dell'attivita promozionata
  // Risultato atteso: Il badge/sconto della promozione e visibile ai genitori
  test.fixme("TC-028 - Promozioni attive visibili", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Bassa | Precondizioni: Attività con copertina/galleria caricate dal Gestore (vedi TC-116)
  // Passi: Apri il dettaglio di un'attività con foto caricate
  // Risultato atteso: L'header mostra la copertina reale (non il gradiente) e sotto ai badge compare una striscia orizzontale scorrevole con le foto della galleria
  // AGGIORNATO (TC-145 assorbito qui, stessa precondizione): le foto ora si
  // aprono in un visualizzatore a schermo intero stile carosello
  // (components/ImageLightbox.tsx — frecce prev/next, swipe, puntini) invece
  // di restare semplici anteprime statiche non cliccabili.
  test.fixme("TC-115 - Galleria foto e copertina personalizzata nel dettaglio attività", async ({ page }) => {
    // ESCLUSO dall'automazione: dipende da TC-116 (upload immagini) non ancora testabile
  });

  // Segnalazione di Fabrizio: la freccia indietro dal dettaglio attività
  // portava alla Prenotazione ("Prenota Ora") invece che alla pagina
  // precedente reale (es. Cerca). Causa: BookingClient.tsx usava
  // router.push() per il proprio "indietro" ad ogni step, che aggiungeva una
  // voce duplicata "/activity/[id]" nella cronologia subito DOPO
  // "/booking/[id]" — così il router.back() (corretto) del Dettaglio
  // ripescava quella voce duplicata invece della pagina precedente vera.
  // Corretto in BookingClient.tsx#handleBack (vedi TC-159 in prenotazione.spec.ts).
  // Priorita: Alta | Precondizioni: Attività di test raggiungibile da Cerca
  test("TC-160 - La freccia indietro dal dettaglio attività non porta più alla Prenotazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    await page.goto("/search");
    await page.getByPlaceholder("Cerca attività, centri, sport...").fill("[TEST] Attività BuddyKids");
    const card = page.getByText("[TEST] Attività BuddyKids").first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Attività di test non trovata: esegui prima supabase/seed-test-data.sql.");
    }
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/activity/${TEST_ACTIVITY_SLUG}`));

    await page.getByLabel("Indietro").click();
    // Deve tornare a Cerca, non finire su /booking/...
    await expect(page).toHaveURL(/\/search/);
  });

  // Segnalazione: le card attività (lista/orizzontali) mostravano sempre
  // solo emoji+gradiente, ignorando la foto di copertina caricata dal
  // gestore per l'attività di test "Test" — ora rendono activity.coverImageUrl
  // come background quando presente (ActivityCard.tsx/ActivityCardHorizontal.tsx).
  // Priorita: Bassa | Precondizioni: Attività con una cover_image_url impostata dal gestore
  test("TC-161 - La card attività mostra la foto di copertina reale quando presente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un'attività con copertina caricata.");
    await loginAs(page, "parent");
    await page.goto("/search");
    const cardWithCover = page.locator('[style*="background-image"]').first();
    if (!(await cardWithCover.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività con copertina caricata trovata per l'account di test in questo momento.");
    }
    const style = await cardWithCover.getAttribute("style");
    expect(style).toMatch(/background-image:\s*url\(/);
  });

  // Nuova funzionalità richiesta da Fabrizio: "in ogni sezione del camp deve
  // esserci una funzionalità di 'Chatta'/'Contatta' il gestore" — ticketing
  // semplice (vedi ContactCenterButton.tsx, lib/data/inquiries.ts,
  // supabase/schema.sql#activity_inquiries). Un messaggio, una risposta.
  // Priorita: Alta | Precondizioni: Attività di test raggiungibile, genitore loggato
  test("TC-162 - 'Contatta il gestore' dal dettaglio invia una richiesta visibile in 'Le mie richieste'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato: la richiesta va scritta davvero in activity_inquiries.");
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);

    await page.getByRole("button", { name: "Contatta il gestore" }).click();
    await expect(page.getByText("Contatta il gestore").last()).toBeVisible();

    const message = `Messaggio di test Playwright ${Date.now()}`;
    await page.getByPlaceholder(/posti per la settimana/).fill(message);
    await page.getByRole("button", { name: "Invia" }).click();
    await expect(page.getByText("Richiesta inviata")).toBeVisible();
    await page.getByRole("button", { name: "Chiudi" }).click();

    await page.goto("/richieste");
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText("In attesa di risposta").first()).toBeVisible();
  });

  // Richiesta di Fabrizio: "hai aggiunto come servizio l'accesso ai disabili?
  // e per chi offre servizio di pranzo, la possibilità di gestire diete
  // specifiche ed intolleranze? è una caratteristica che il gestore flagga e
  // poi si vede lato genitore". Badge aggiunti in DetailClient.tsx (ServiceTag
  // "Accesso disabili" + chips "Diete e intolleranze gestite") — mostrati solo
  // se il gestore ha effettivamente flaggato il campo (vedi TC-198/TC-199).
  // Priorita: Media | Precondizioni: Nessuna
  test.fixme("TC-196 - Il dettaglio attività mostra il badge 'Accesso disabili' coerente col centro", async ({ page }) => {
    // TODO: implementare - richiede un'attività di test il cui centro abbia
    // centers.accessible=true (non garantito dal seed attuale). Vedi
    // ServiceTag "Accesso disabili" in app/activity/[id]/DetailClient.tsx.
  });

  // Priorita: Media | Precondizioni: Attività con dietary_options non vuoto
  test.fixme("TC-197 - Il dettaglio attività mostra le chips 'Diete e intolleranze gestite' quando presenti", async ({ page }) => {
    // TODO: implementare - richiede un'attività di test con
    // activities.dietary_options non vuoto (non garantito dal seed attuale).
    // Vedi sezione "Diete e intolleranze gestite" in DetailClient.tsx: non
    // deve comparire affatto se l'array è vuoto/assente.
  });

  // Priorita: Media | Precondizioni: Attività con almeno una Certificazione servizio con status='approved' (vedi TC-200/TC-201)
  // Passi: Apri /activity/[slug] dell'attività certificata
  // Risultato atteso: Compare la sezione "Certificazioni" con un badge per etichetta; le richieste ancora "pending" o "rejected" NON compaiono (vedi getApprovedCertificationsForActivity in lib/data/certifications.ts)
  test.fixme("TC-202 - Il dettaglio attività mostra solo le Certificazioni approvate", async ({ page }) => {
    // TODO: implementare - richiede una certificazione già approvata da un
    // admin (TC-201), non garantita dal seed attuale.
  });

  // Segnalazione di Fabrizio: "non vedo ancora i badge di certificazione
  // sulle schede dei centri" — le certificazioni approvate erano lette SOLO
  // dal dettaglio attività (vedi TC-202 sopra); ora getActivities()
  // (lib/data/activities.ts) le carica in blocco per tutta la lista e
  // ActivityCard/ActivityCardHorizontal mostrano il badge "ti-certificate".
  // Priorita: Media | Precondizioni: Attività con almeno una Certificazione servizio con status='approved' (vedi TC-200/TC-201)
  // Passi: Apri Cerca/Home con l'attività certificata tra i risultati
  // Risultato atteso: La card mostra il badge di certificazione (icona + etichetta su ActivityCard, icona su ActivityCardHorizontal)
  test.fixme("TC-208 - Le card di lista/ricerca mostrano il badge di Certificazione servizio", async ({ page }) => {
    // TODO: implementare - come TC-202, richiede una certificazione già
    // approvata da un admin, non garantita dal seed attuale.
  });

  // Segnalazione di Fabrizio (screenshot): "sul badge del centro non si vede
  // nulla nè sul badge disabili" — stesso gap di TC-208, stessa causa (dato
  // già presente in Activity ma mai renderizzato sulla card), stesso fix.
  // Priorita: Media | Precondizioni: Attività il cui centro abbia accessible=true (vedi TC-196)
  // Passi: Apri Cerca/Home con l'attività tra i risultati
  // Risultato atteso: La card mostra il badge "Accesso disabili" (etichetta su ActivityCard, icona sedia a rotelle su ActivityCardHorizontal)
  test.fixme("TC-209 - Le card di lista/ricerca mostrano il badge Accesso disabili", async ({ page }) => {
    // TODO: implementare - come TC-196, richiede seed con centers.accessible=true, non garantito dal seed attuale.
  });

  // Segnalazione di Fabrizio (screenshot): "nè sul badge gestione diete
  // speciali" — stesso gap di TC-208/TC-209.
  // Priorita: Media | Precondizioni: Attività con dietary_options non vuoto (vedi TC-197)
  // Passi: Apri Cerca/Home con l'attività tra i risultati
  // Risultato atteso: La card mostra il badge "Diete gestite" (etichetta su ActivityCard, icona insalata su ActivityCardHorizontal)
  test.fixme("TC-210 - Le card di lista/ricerca mostrano il badge Diete gestite", async ({ page }) => {
    // TODO: implementare - come TC-197, richiede seed con activities.dietary_options non vuoto, non garantito dal seed attuale.
  });

});
