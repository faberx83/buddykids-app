import { test, expect, gotoAsRole } from "../fixtures/roles";

// Area: Gestore - Dashboard
// NOTA: la dashboard e' "volutamente demo" (task #19 nel roadmap del team) -
// mostra sempre i dati di lib/mock-data.ts anche con Supabase configurato.
// Il test verifica quindi la struttura/i KPI, non dati "reali" per design.

test.describe("Gestore - Dashboard", () => {
  // TC-072 - Dashboard Gestore carica KPI e sezioni chiave
  test("TC-072 - /center mostra KPI, occupazione settimanale e 'Le tue attività'", async ({ page }) => {
    await gotoAsRole(page, "center_admin", "/center");

    await expect(page.getByText("Attività", { exact: true })).toBeVisible();
    await expect(page.getByText("Prenotazioni", { exact: true })).toBeVisible();
    await expect(page.getByText("Promozioni attive")).toBeVisible();
    await expect(page.getByText("Fatturato confermato")).toBeVisible();
    await expect(page.getByText("Occupazione settimanale")).toBeVisible();
    await expect(page.getByText("Le tue attività")).toBeVisible();
  });
  // Priorita: Media | Precondizioni: Login Gestore, almeno una Richiesta Gruppo in sospeso
  // Passi: Apri /center, osserva il menu laterale
  // Risultato atteso: Le voci di menu sono raggruppate sotto intestazioni (\"Oggi\"/\"Gestione\"); la voce \"Richieste Gruppo\" mostra un badge rosso col numero di richieste in sospeso
  test.fixme("TC-119 - Nuova navigazione con raggruppamento sezioni e badge richieste in sospeso", async ({ page }) => {
    // PENDING: funzionalita non presente nel repo GitHub ispezionato
    // (risulta implementata in una sessione locale non ancora pushata).
  });

  // Priorita: Media | Precondizioni: Centro con almeno una settimana con occupazione bassa, o una Richiesta Gruppo in sospeso
  // Passi: Apri /center
  // Risultato atteso: In cima alla dashboard compaiono banner dedicati per le settimane scariche e per le richieste in sospeso, prima delle metriche KPI
  test.fixme("TC-120 - Banner settimane scariche / richieste gruppo in sospeso", async ({ page }) => {
    // PENDING: funzionalita non presente nel repo GitHub ispezionato
    // (risulta implementata in una sessione locale non ancora pushata).
  });

  // Priorita: Bassa | Precondizioni: Login Gestore
  // Passi: Apri /center, osserva la colonna destra
  // Risultato atteso: Al posto della vecchia lista \"Le tue attività\" compare un feed cronologico che unisce settimane scariche, richieste gruppo, prenotazioni e promozioni
  test.fixme("TC-121 - Feed attività unificato \"Attività recente\"", async ({ page }) => {
    // PENDING: funzionalita non presente nel repo GitHub ispezionato
    // (risulta implementata in una sessione locale non ancora pushata).
  });

});
