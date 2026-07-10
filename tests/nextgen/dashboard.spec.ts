import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Dashboard Genitore (Sprint 1)
// Riprogettazione della home genitore come centro di controllo famiglia:
// copertura prima di tutto, poi prossimi impegni, attività in evidenza,
// stato/riepilogo. L'elenco completo (Vista/Raggruppamento/Ordinamento)
// resta secondario, collassato di default. Cartella separata da
// tests/nextgen/smoke.spec.ts (Sprint 0) e da tests/genitori (LEGACY).
//
// SPRINT CORRETTIVO: TC-N07 aggiornato al nuovo testo della Hero Card
// ("Organizzata al N%" sostituisce "organizzato per N settimane su M") — vedi
// tests/nextgen/home-refinement.spec.ts per i nuovi casi (Hero Card,
// check-in, prenotazioni visuali).

test.describe("NEXTGEN - Dashboard Genitore (Sprint 1)", () => {
  test("TC-N07 - La copertura dell'estate è il primo contenuto mostrato (Hero Card)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    // La Hero Card precede sia "Prossimo appuntamento" sia le statistiche.
    const coverageText = page.getByText(/Organizzata al \d+%/);
    await expect(coverageText.first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N08 - L'elenco completo prenotazioni è secondario e collassato di default", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const toggle = page.getByText(/Tutte le prenotazioni/);
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione per l'account di test: la sezione secondaria non viene mostrata.");
    }
    // Raggruppamento/Ordinamento non visibili finché non si espande.
    await expect(page.getByText("Raggruppa:")).toHaveCount(0);
    await toggle.click();
    await expect(page.getByText("Raggruppa:")).toBeVisible();
    await expect(page.getByText("Ordina:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Gestisci \(modifica\/annulla\)/ })).toHaveAttribute(
      "href",
      "/prenotazioni"
    );
  });

  test("TC-N09 - Statistiche sintetiche (confermate/in attesa/speso) sempre visibili", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText("Confermate")).toBeVisible();
    await expect(page.getByText("In attesa")).toBeVisible();
    await expect(page.getByText("Speso finora")).toBeVisible();
  });
});
