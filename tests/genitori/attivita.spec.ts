import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Attivita
// Convertiti da gotoAsRole a loginAs (Home/dettaglio richiedono sessione
// reale contro un deploy con Supabase configurato). Attività seminata da
// supabase/seed-test-data.sql, slug usato direttamente come "id" di rotta.
const TEST_ACTIVITY_SLUG = "attivita-test-buddykids";

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

  // TC-026 - Preferiti (cuore) - noto FUNCTIONAL/gap: non persiste al reload (useState locale).
  // BUG DI TEST TROVATO+CORRETTO (run reale): app/activity/[id]/DetailClient.tsx
  // inizializza "fav" con useState(true) — il cuore parte SEMPRE pieno ad ogni
  // caricamento/reload, indipendentemente da eventuali click precedenti. Il
  // test originale assumeva (erroneamente) che lo stato di default fosse
  // "non preferito" e si aspettava il cuore vuoto dopo il reload; in realtà
  // torna sempre pieno (stato iniziale hardcoded), quindi l'assert falliva
  // sempre contro un deploy reale. Corretto per riflettere il comportamento
  // reale: il gap di persistenza resta (nessun salvataggio vero), ma il
  // valore a cui si torna dopo reload è "preferito", non il contrario.
  test("TC-026 - il click sul preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);
    // Stato di default reale: pieno (useState(true) in DetailClient.tsx).
    await expect(page.locator(".ti-heart-filled").first()).toHaveCount(1);
    const heart = page.locator(".ti-heart, .ti-heart-filled").first();
    await heart.click();
    await expect(page.locator(".ti-heart").first()).toHaveCount(1); // svuotato localmente
    await page.reload();
    // Il reload NON persiste il click: torna allo stato iniziale hardcoded (pieno).
    await expect(page.locator(".ti-heart-filled").first()).toHaveCount(1);
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

});
