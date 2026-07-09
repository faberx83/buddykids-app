import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Gestore - Attivita

test.describe("Gestore - Attivita", () => {
  // TC-073 - Elenco attivita del centro (lettura, funziona anche in mock mode)
  test("TC-073 - /center/activities mostra le attività del centro collegato", async ({ page }) => {
    await gotoAsRole(page, "center_admin", "/center/activities");
    // Il centro demo (demoCenterAdminCenterId) ha almeno l'attivita' "Summer Camp Acquatico".
    await expect(page.getByText("Summer Camp Acquatico")).toBeVisible();
  });

  // TC-074 - Creazione nuova attivita (richiede Supabase configurato)
  test("TC-074 - creare una nuova attività la salva e reindirizza alla modifica", async ({ page }) => {
    test.skip(
      !process.env.TEST_BASE_URL,
      "Richiede un deploy con Supabase configurato (scrittura reale su Supabase)."
    );
    await page.goto("/center/activities/new");
    // TODO: compilare il form reale una volta verificati i campi su un deploy configurato.
  });
  // Priorita: Alta | Precondizioni: Attivita esistente
  // Passi: Apri un'attivita -> modifica prezzo/eta/servizi/tag -> salva
  // Risultato atteso: I dati si aggiornano su Supabase, log azione registrato
  test.fixme("TC-075 - Modifica attivita", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Attivita esistente
  // Passi: Apri 'Calendario' dell'attivita -> apri/chiudi giorni, aggiorna posti, giornata speciale -> salva
  // Risultato atteso: I dati si aggiornano su activity_days
  test.fixme("TC-076 - Calendario disponibilita giorno-per-giorno", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Account center_admin senza center_id valorizzato
  // Passi: Apri /center/activities o /center/activities/new
  // Risultato atteso: Messaggio chiaro che serve completare l'assegnazione via SQL, nessun crash
  test.fixme("TC-077 - Nessun centro collegato all'account", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Priorita: Media | Precondizioni: Login Gestore, attività esistente
  // Passi: Vai su Gestore > Attività > Modifica, sezione \"Immagini\"
  // Risultato atteso: Si può caricare/cambiare/rimuovere una copertina e aggiungere più foto alla galleria; il salvataggio scrive su Supabase Storage e sulla scheda attività
  test.fixme("TC-116 - Upload copertina + galleria foto di un'attività", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

});
