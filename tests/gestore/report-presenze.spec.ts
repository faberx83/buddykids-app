import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Report presenze
// Nuova funzionalità (richiesta da Fabrizio, oltre al Registro presenze
// giorno-per-giorno già esistente): "vorrei un report grafico anche sul
// report delle presenze" — andamento nel tempo, tasso assenza/ritardo per
// attività, elenco "ritardatari abituali" (bambini con almeno 2 giorni in
// ritardo/assente). Vedi lib/data/attendance-report.ts,
// components/charts/AttendanceTrendChart.tsx,
// components/charts/AttendanceRateByActivityChart.tsx.

test.describe("Gestore - Report presenze", () => {
  test("TC-165 - Il Report presenze mostra le tre sezioni (andamento, per attività, ritardatari)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/report-presenze");

    await expect(page.getByRole("heading", { name: "Report presenze" })).toBeVisible();
    await expect(page.getByText("Andamento nel tempo")).toBeVisible();
    await expect(page.getByText("Tasso assenza/ritardo per attività")).toBeVisible();
    await expect(page.getByText("Ritardatari abituali")).toBeVisible();

    // O il grafico con dati reali, o il messaggio "nessun giorno trascorso":
    // in ogni caso la pagina non deve andare in errore.
    const noPastData = page.getByText(/Nessun giorno di camp è ancora trascorso/);
    const noPastDataVisible = await noPastData.isVisible().catch(() => false);
    if (!noPastDataVisible) {
      // Se c'è almeno un giorno passato, l'asse X del grafico ha almeno
      // un'etichetta data (formato "g/m").
      await expect(page.locator("svg").first()).toBeVisible();
    }
  });

  test("TC-166 - La voce 'Report presenze' è nel menu Gestione con link funzionante", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    // Gate C (28/07): su mobile (mobile-chrome) la nav vive dietro un
    // cassetto (drawer) aperto da un bottone hamburger, renderizzato SOLO
    // quando drawerOpen=true (DashboardLayout.tsx righe 286/321 — `md:hidden`
    // + `{drawerOpen && (...)}`) — su desktop la sidebar è sempre nel DOM. Il
    // test cercava il link direttamente, che su mobile non esiste ancora nel
    // DOM finché il drawer non viene aperto: timeout. Apriamo il drawer solo
    // se il bottone hamburger è presente (mobile), altrimenti il link è già
    // raggiungibile come su desktop.
    const hamburger = page.getByRole("button", { name: "Apri il menu" });
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
    }

    await page.getByRole("link", { name: "Report presenze" }).click();
    await expect(page).toHaveURL(/\/center\/report-presenze/);
    await expect(page.getByRole("heading", { name: "Report presenze" })).toBeVisible();
  });
});
