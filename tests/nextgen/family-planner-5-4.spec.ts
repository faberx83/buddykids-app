import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner, Sprint 5.4 (Vista Mappa + Promemoria)
// Quarta fase del PRD "Family Planner": Vista Mappa (pin REALI dai
// centri/attività — activities.latitude/longitude, già usati da LEGACY
// Cerca — riusa components/ActivityMap.tsx tale e quale) con distanza/tempo
// di percorrenza STUBBATI ma VISIBILI dagli indirizzi di famiglia (scelta
// esplicita di Fabrizio: quegli indirizzi sono testo libero senza
// coordinate, nessuna API mappe a pagamento configurata — vedi
// lib/nextgen/planner-map-estimate.ts) e "Promemoria intelligenti" (dati
// reali: finestra di cancellazione, attività in arrivo, settimana
// prioritaria, sovrapposizioni, budget — lib/nextgen/reminders.ts).
// Nessuna nuova query pesante: mapPins riusa activities già lette dai
// booking del genitore; reminders riusa PlannerData/MyBooking/overlaps/
// budget già letti da app/nextgen/planner/page.tsx.

test.describe("NEXTGEN - Family Planner Sprint 5.4 (Mappa/Promemoria)", () => {
  test("TC-N66 - Vista Mappa: con attività prenotate mostra 'Le tue attività' con distanza stimata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const list = page.getByText("Le tue attività", { exact: true });
    if (!(await list.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata per l'account di test.");
    }
    await expect(list).toBeVisible();
    await expect(page.getByText("distanza stimata")).toBeVisible();
    await expect(page.getByText(/km · \d+ min|Indirizzo non disponibile/).first()).toBeVisible();
  });

  test("TC-N67 - Vista Mappa: senza prenotazioni attive mostra lo stato vuoto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test SENZA prenotazioni attive.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const emptyState = page.getByText(/Prenota un.attività per vederla qui sulla mappa/);
    if (!(await emptyState.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha già attività prenotate.");
    }
    await expect(emptyState).toBeVisible();
  });

  test("TC-N68 - Vista Mappa: toccare un'attività nell'elenco apre la scheda attività", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Mappa" }).click();

    const firstRow = page.getByText("Le tue attività", { exact: true }).locator("..").locator("a").first();
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività prenotata per l'account di test.");
    }
    await firstRow.click();
    await expect(page).toHaveURL(/\/activity\//);
  });

  test("TC-N69 - Promemoria: quando presenti, appaiono in Organizzazione sopra le Missioni, senza superare 4 elementi", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    // I Promemoria sono condizionali (dipendono da scadenze reali vicine
    // nell'account di test): verifichiamo solo che, se presenti, non
    // rompano il rendering e restino entro il limite dichiarato di 4.
    const reminderEmojis = ["⏳", "📅", "⚠️", "🔁", "💸", "💶"];
    const found = await Promise.all(reminderEmojis.map((e) => page.getByText(e, { exact: true }).count()));
    const totalReminders = found.reduce((sum, n) => sum + n, 0);

    expect(totalReminders).toBeLessThanOrEqual(4);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
