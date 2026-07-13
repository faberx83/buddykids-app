import { test, expect } from "../fixtures/roles";
import { gotoAsRole, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Profilo Centro
// Generato da BuddyKids_Test_Case.xlsx - 3 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.

test.describe("Gestore - Profilo Centro", () => {
  // Priorita: Media | Precondizioni: Account collegato a un centro
  // Passi: Vai su /center/profile -> modifica nome/citta/descrizione/social -> salva
  // Risultato atteso: Dati aggiornati, visibili ai genitori
  test.fixme("TC-080 - Modifica profilo centro", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: In /center/profile, spunta 'Il centro ha un bar / punto ristoro' -> salva
  // Risultato atteso: Il valore has_bar=true si riflette nel filtro Servizi lato genitori
  test.fixme("TC-081 - Attivazione campo Bar", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Bassa | Precondizioni: Login Gestore
  // Passi: Vai su Gestore > Il mio centro, clicca l'icona fotocamera sul cerchio in alto
  // Risultato atteso: Il logo sostituisce l'emoji/gradiente di default; viene salvato al click su \"Salva modifiche\" insieme al resto del form
  test.fixme("TC-117 - Upload logo/foto del centro", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

  // Domanda di Fabrizio: "il processo di eventuale annullamento della
  // prenotazione: entro quanto si può fare? può essere una variabile
  // gestibile da ciascun centro estivo?" — risposta: sì, campo
  // centers.cancellation_window_days (default 3 giorni), modificabile qui.
  // Priorita: Alta | Precondizioni: Account collegato a un centro
  test("TC-192 - Il centro può configurare i giorni di preavviso per annullo/modifica prenotazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    await expect(page.getByText("Cancellazioni e modifiche")).toBeVisible();
    const field = page.locator("input[type='number']").last();
    await field.fill("5");
    await page.getByRole("button", { name: /Salva/ }).first().click();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // Richiesta di Fabrizio: badge "Accesso disabili" a livello di centro,
  // editabile anche dal Profilo centro (oltre che dalla scheda attività, vedi
  // TC-198) — stesso trattamento di "Il centro ha un bar / punto ristoro".
  // Priorita: Media | Precondizioni: Account collegato a un centro
  test("TC-199 - Il gestore può flaggare 'Accessibilità' dal Profilo centro", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    await expect(page.getByText("Accessibilità")).toBeVisible();
    const accessibleCheckbox = page.getByText("Il centro è accessibile (rampe, bagno attrezzato, ecc.)").locator("..").locator("input[type='checkbox']");
    await accessibleCheckbox.setChecked(true);
    await expect(page.getByPlaceholder("Es. Rampa d'accesso, bagno attrezzato")).toBeVisible();

    await page.getByRole("button", { name: /Salva/ }).first().click();
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
