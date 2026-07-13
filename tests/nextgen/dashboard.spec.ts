import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Dashboard Genitore (Sprint 1)
// Riprogettazione della home genitore come centro di controllo famiglia:
// copertura prima di tutto, poi prossimi impegni, attività in evidenza,
// stato/riepilogo. Cartella separata da tests/nextgen/smoke.spec.ts
// (Sprint 0) e da tests/genitori (LEGACY).
//
// SPRINT CORRETTIVO: TC-N07 aggiornato al nuovo testo della Hero Card
// ("Organizzata al N%" sostituisce "organizzato per N settimane su M") — vedi
// tests/nextgen/home-refinement.spec.ts per i nuovi casi (Hero Card,
// check-in, prenotazioni visuali).
//
// SPRINT 5.1: TC-N08/TC-N09 aggiornati — "Home ridotta a sola sintesi"
// (richiesta esplicita di Fabrizio, PRD Family Planner) ha rimosso l'elenco
// completo raggruppabile ("Tutte le prenotazioni") e le Statistiche
// (Confermate/In attesa/Speso finora) da Home NEXTGEN: quel dettaglio vive
// ora nel Planner (Organizzazione/Budget) e in "/prenotazioni" (LEGACY).
// Vedi tests/nextgen/family-planner-5-1.spec.ts per i nuovi casi.

test.describe("NEXTGEN - Dashboard Genitore (Sprint 1)", () => {
  test("TC-N07 - La copertura dell'estate è il primo contenuto mostrato (Hero Card)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    // La Hero Card precede sia "Prossimo appuntamento" sia la CTA "Apri Planner".
    const coverageText = page.getByText(/Organizzata al \d+%/);
    await expect(coverageText.first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N08 - Home NON mostra più l'elenco completo raggruppabile (spostato in Planner/'/prenotazioni')", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText(/Tutte le prenotazioni/)).toHaveCount(0);
    await expect(page.getByText("Raggruppa:")).toHaveCount(0);
    await expect(page.getByText("Ordina:")).toHaveCount(0);
  });

  test("TC-N09 - Home NON mostra più le Statistiche (Confermate/In attesa/Speso finora)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText("Confermate", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Speso finora")).toHaveCount(0);
  });
});
