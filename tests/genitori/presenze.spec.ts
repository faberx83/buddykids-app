import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Genitori - Le presenze
// Generato da BuddyKids_Test_Case.xlsx.
//
// Versione GENITORE del Report presenze già esistente lato Gestore (vedi
// tests/gestore/report-presenze.spec.ts) — richiesta di Fabrizio insieme
// all'auto-hide del banner di check-in in Home. "Opportunamente rivisto"
// rispetto alla versione Gestore: niente tasso per attività dell'intero
// centro né "ritardatari abituali" (quella lista serve al gestore per
// contattare ALTRE famiglie — un genitore vede solo i propri figli). Vedi
// lib/data/attendance-report.ts#getAttendanceReportForParent,
// app/(main)/presenze/page.tsx.
test.describe("Genitori - Le presenze", () => {
  test("TC-222 - La pagina Le presenze mostra andamento e riepilogo per bambino (o il messaggio nessun dato)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/presenze");

    await expect(page.getByRole("heading", { name: "Le presenze" })).toBeVisible();

    // O il report con dati reali, o il messaggio "nessun giorno trascorso":
    // in ogni caso la pagina non deve andare in errore, e non deve MAI
    // mostrare "Ritardatari abituali" (quella sezione e' solo lato Gestore).
    const noPastData = page.getByText(/Nessun giorno di camp è ancora trascorso/);
    const noPastDataVisible = await noPastData.isVisible().catch(() => false);
    if (!noPastDataVisible) {
      await expect(page.getByText("Andamento nel tempo")).toBeVisible();
      await expect(page.getByText("Riepilogo per bambino")).toBeVisible();
    }
    await expect(page.getByText("Ritardatari abituali")).toHaveCount(0);
  });
});
