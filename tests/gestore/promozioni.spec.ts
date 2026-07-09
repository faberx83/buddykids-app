import { test, expect } from "../fixtures/roles";
import { gotoAsRole } from "../fixtures/roles";

// Area: Gestore - Promozioni
// Generato da BuddyKids_Test_Case.xlsx - 2 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.

test.describe("Gestore - Promozioni", () => {
  // Priorita: Media | Precondizioni: Attivita esistente
  // Passi: Vai su /center/promotions -> crea promo (sconto giorno fisso o last-minute)
  // Risultato atteso: Promozione salvata, visibile ai genitori nel dettaglio attivita
  test.fixme("TC-078 - Creazione promozione", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Bassa | Precondizioni: Promozione esistente
  // Passi: Toggle attivo/non attivo
  // Risultato atteso: Stato aggiornato su Supabase
  test.fixme("TC-079 - Attiva/disattiva promozione", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

});
