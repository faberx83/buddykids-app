import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Genitori - Attivita
// ID attivita reale preso da lib/mock-data.ts (dati demo).
const DEMO_ACTIVITY_ID = "summer-camp-acquatico";

test.describe("Genitori - Attivita", () => {
  // TC-025 - Apertura scheda attivita
  test("TC-025 - aprire una card da Home porta al dettaglio con dati reali", async ({ page }) => {
    await gotoAsRole(page, "parent", "/");
    await page.getByText("Summer Camp Acquatico").first().click();

    await expect(page).toHaveURL(new RegExp(`/activity/${DEMO_ACTIVITY_ID}`));
    await expect(page.getByText("Servizi disponibili")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prenota ora" })).toBeVisible();
  });

  // TC-026 - Preferiti (cuore) - noto FUNCTIONAL/gap: non persiste al reload (useState locale).
  // Il test verifica lo stato ATTUALE noto (fallisce quando il gap verra' risolto: aggiornare allora).
  test("TC-026 - il preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)", async ({
    page,
  }) => {
    await gotoAsRole(page, "parent", `/activity/${DEMO_ACTIVITY_ID}`);
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
