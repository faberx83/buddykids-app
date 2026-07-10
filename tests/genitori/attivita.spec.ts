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
  // Il test verifica lo stato ATTUALE noto (fallisce quando il gap verra' risolto: aggiornare allora).
  test("TC-026 - il preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'attività di test seminata.");
    await loginAs(page, "parent");
    await page.goto(`/activity/${TEST_ACTIVITY_SLUG}`);
    const heart = page.locator(".ti-heart, .ti-heart-filled").first();
    await heart.click();
    await page.reload();
    // Stato atteso oggi: torna non-preferito (useState locale, non salvato).
    await expect(page.locator(".ti-heart-filled").first()).toHaveCount(0);
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
  test.fixme("TC-115 - Galleria foto e copertina personalizzata nel dettaglio attività", async ({ page }) => {
    // ESCLUSO dall'automazione: dipende da TC-116 (upload immagini) non ancora testabile
  });

});
