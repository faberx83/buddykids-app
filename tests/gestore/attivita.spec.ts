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
  // TC-075 - Modifica attivita
  // Include anche la verifica di due fix di coerenza UI recenti:
  // - la voce di nav "Attività" resta evidenziata anche sulla sotto-rotta di
  //   modifica (prima solo su corrispondenza esatta con /center/activities,
  //   vedi components/dashboard/DashboardLayout.tsx);
  // - il bottone "Usa posizione attuale" nella sezione "Posizione" compila
  //   lat/lng dal geolocation del browser (stessa logica del filtro Home
  //   genitore, vedi HomeFeed.tsx).
  test("TC-075 - aprire e modificare un'attività aggiorna i dati e la posizione", async ({
    page,
    context,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");

    // Selettore preciso della card (combo di classi usata SOLO dalle card
    // attività in questa pagina — evita di prendere un div ancestor/discendente
    // qualsiasi che contenga lo stesso testo, vedi app/center/activities/page.tsx).
    const card = page.locator("div.rounded-lg.border").filter({ hasText: "[TEST] Attività BuddyKids" });
    await card.getByRole("link", { name: "Modifica scheda" }).click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+$/);

    // Nav "Attività" evidenziata anche sulla sotto-rotta di modifica.
    await expect(page.getByRole("link", { name: /^\s*Attività$/ }).first()).toHaveClass(/bg-partner-light|bg-partner\b/);

    // Geolocalizzazione: stesso pattern del filtro Home genitore.
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano
    await page.getByRole("button", { name: /Usa posizione attuale/ }).click();
    await expect(page.locator('input[type="number"][step="0.0001"]').first()).toHaveValue("45.4642", {
      timeout: 10_000,
    });
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
