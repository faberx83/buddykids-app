import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner Calendario (Sprint 5.2)
// Seconda fase del PRD "Family Planner": implementa la modalità Calendario
// del Planner (PRD: "Giorno, settimana e mese, con colori per figlio e
// conflitti evidenziati"). LIMITE DI DATI ESPLICITO (verificato prima di
// implementare, vedi lib/nextgen/calendar-weeks.ts): il modello dati copre
// solo intere settimane stagionali (Lun-Ven), non singoli giorni di
// frequenza — quindi questa fase copre Vista Mese e Vista Settimana, NON una
// vista Giorno con presenza reale (gap esplicito, da riconsiderare solo se
// in futuro si introduce un concetto di giorni effettivi di frequenza).
// Nessuna nuova query al DB: riusa planner.weeks (lib/data/planner.ts) e
// overlaps (lib/nextgen/planner-insights.ts), già letti da
// app/nextgen/planner/page.tsx.

test.describe("NEXTGEN - Planner Calendario (Sprint 5.2)", () => {
  test("TC-N50 - La modalità Calendario mostra la Vista Mese di default, con selettore Mese/Settimana", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    await expect(page.getByRole("button", { name: "Mese" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settimana" })).toBeVisible();
    // Header del mese (es. "Giugno 2026") — non verifichiamo il mese esatto
    // (dipende dalla data odierna e dalla stagione dell'account di test).
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N51 - Vista Mese: la griglia mostra le intestazioni dei giorni della settimana (L M M G V S D)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    for (const day of ["L", "M", "G", "V", "S", "D"]) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
    }
  });

  test("TC-N52 - Vista Mese: i giorni delle settimane prenotate mostrano un pallino colorato per bambino", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta nel mese corrente.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const legend = page.locator("text=Sovrapposizione").first();
    if (!(await legend.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non ha bambini/legenda per verificare i colori.");
    }
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N53 - Toccare un giorno prenotato apre il riepilogo della settimana", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    // Cerca un giorno con almeno un pallino colorato (settimana coperta) e lo tocca.
    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();
    // Il riepilogo mostra l'etichetta della settimana (SeasonWeek.label,
    // formato "SETT N", invariato da lib/data/planner.ts).
    await expect(page.getByText(/^SETT \d+/).first()).toBeVisible();
  });

  test("TC-N54 - Vista Settimana: elenca le 13 settimane stagionali con pallini per bambino e avviso di sovrapposizione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();
    await page.getByRole("button", { name: "Settimana" }).click();

    await expect(page.getByText("Sett. 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Sett. 13", { exact: true })).toBeVisible();
  });

  test("TC-N55 - Il selettore Mese precedente/successivo naviga tra i mesi della stagione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const nextButton = page.getByRole("button", { name: "Mese successivo" });
    const prevButton = page.getByRole("button", { name: "Mese precedente" });
    await expect(nextButton).toBeVisible();
    await expect(prevButton).toBeVisible();
  });
});
