import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Admin - Gestione

test.describe("Admin - Gestione", () => {
  // TC-083 - Elenco attivita (tutte) - noto FUNCTIONAL: dati sempre mock (task #19)
  test("TC-083 - /admin/activities elenca le attività (oggi: dati demo)", async ({ page }) => {
    await gotoAsRole(page, "platform_admin", "/admin/activities");
    await expect(page.getByText("Summer Camp Acquatico")).toBeVisible();
  });

  // TC-088 - Gestione tag piattaforma (richiede Supabase configurato per la scrittura)
  test("TC-088 - creare un tag lo rende subito selezionabile", async ({ page }) => {
    test.skip(!process.env.TEST_BASE_URL, "Richiede Supabase configurato (scrittura reale).");
    await page.goto("/admin/tags");
    // TODO: compilare una volta verificati i campi reali del form su un deploy configurato.
  });
  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Apri /admin/bookings
  // Risultato atteso: Dovrebbe riflettere le prenotazioni reali
  test.fixme("TC-084 - Elenco prenotazioni (tutte)", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Apri /admin/centers
  // Risultato atteso: Dovrebbe riflettere i centri reali (salvo il form 'Nuovo centro' che e reale)
  test.fixme("TC-085 - Elenco centri", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: Su /admin/centers, usa il form 'Nuovo centro' -> compila -> salva
  // Risultato atteso: Il centro viene creato su Supabase
  test.fixme("TC-086 - Creazione nuovo centro", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Bassa | Precondizioni: Centro esistente
  // Passi: Apri /admin/centers/[id]
  // Risultato atteso: Dovrebbe mostrare i dati reali del centro
  test.fixme("TC-087 - Dettaglio centro", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Bassa | Precondizioni: Login Admin piattaforma
  // Passi: Vai su Admin > Fornitori consigliati, crea/modifica un fornitore e carica una foto
  // Risultato atteso: La foto sostituisce l'emoji sia nella tabella Admin sia nella card mostrata ai Gestori in \"Servizi consigliati\"
  test.fixme("TC-118 - Upload foto/logo fornitore", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

});
