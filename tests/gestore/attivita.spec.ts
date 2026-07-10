import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Attivita
//
// TC-073/TC-074 convertiti da "Ruolo demo" (gotoAsRole) a login reale
// (loginAs) — contro produzione il ruolo demo è disattivato e i dati mock
// ("Summer Camp Acquatico") non esistono; usiamo invece l'attività seminata
// da supabase/seed-test-data.sql ("[TEST] Attività BuddyKids").

test.describe("Gestore - Attivita", () => {
  // TC-073 - Elenco attivita del centro
  test("TC-073 - /center/activities mostra le attività del centro collegato", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test collegato al centro.");
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");
    await expect(page.getByText("[TEST] Attività BuddyKids")).toBeVisible();
  });

  // TC-074 - Creazione nuova attivita (richiede Supabase configurato)
  test("TC-074 - creare una nuova attività la salva e reindirizza alla modifica", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato (scrittura reale su Supabase)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/activities/new");

    const name = `[TEST] Attività auto ${Date.now()}`;
    await page.getByPlaceholder("Es. Laboratorio Arti Creative").fill(name);
    await page.locator('input[type="number"]').fill("100");
    await page.getByRole("button", { name: "Crea attività" }).click();

    await expect(page).toHaveURL(/\/center\/activities\/.+/, { timeout: 15_000 });
    await expect(page.getByText(name)).toBeVisible();
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
