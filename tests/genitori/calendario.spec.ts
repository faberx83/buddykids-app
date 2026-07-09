import { test, expect } from "../fixtures/roles";
import { gotoAsRole } from "../fixtures/roles";

// Area: Genitori - Calendario
// Generato da BuddyKids_Test_Case.xlsx - 2 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.

test.describe("Genitori - Calendario", () => {
  // Priorita: Alta | Precondizioni: Bambino con prenotazione confermata
  // Passi: Vai su /calendar
  // Risultato atteso: Gli eventi mostrati riflettono le prenotazioni reali
  test.fixme("TC-064 - Calendario personale", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Media | Precondizioni: Prenotazione con giorni specifici frequentati
  // Passi: Apri tab 'Calendari centri'
  // Risultato atteso: I giorni effettivamente prenotati dovrebbero essere evidenziati
  test.fixme("TC-065 - Giorni evidenziati calendario centro", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

});
