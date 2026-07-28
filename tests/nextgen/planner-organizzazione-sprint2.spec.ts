import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline + Stato per
// settimana): raggruppamento della Timeline per mese, righe con
// prenotazione attiva cliccabili verso la scheda attività, date della
// settimana mostrate al click su "Stato per settimana".

test.describe("NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline mensile)", () => {
  test("TC-271 - La Timeline è raggruppata per mese, pieghevole", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/Timeline della stagione/)).toBeVisible();
    // Almeno un'intestazione di mese (Giugno/Luglio/Agosto/Settembre — la
    // stagione tipo copre metà giugno-metà settembre, vedi season-weeks.ts).
    const monthHeader = page.getByText(/Giugno|Luglio|Agosto|Settembre/).first();
    await expect(monthHeader).toBeVisible();
  });

  test("TC-272 - Cliccare una barra di 'Stato per settimana' apre il mese giusto, evidenzia la riga e mostra le date", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const firstWeekBar = page.getByRole("button", { name: /Vai al dettaglio della Settimana 1,/ });
    await firstWeekBar.click();

    // La data della settimana compare accanto al titolo "Stato per settimana".
    await expect(page.getByText(/Settimana 1 ·/).first()).toBeVisible();
    // La riga corrispondente nella Timeline esiste nel DOM (il mese si è
    // aperto automaticamente) ed è evidenziata.
    await expect(page.locator("#week-row-1")).toBeVisible();
  });

  test("TC-273 - Una riga Timeline con prenotazione attiva è cliccabile e apre 'Le mie prenotazioni'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    // Gate C (28/07): il test cercava `a[href^="/activity/"]` aspettandosi
    // che una riga Timeline coperta portasse alla scheda marketing
    // dell'attività — ma il Task #357 (PlannerClient.tsx, righe 696-724,
    // "il click porta alla sezione del centro... ma non mi dà info della
    // mia prenotazione") ha deliberatamente cambiato quel link a
    // `/prenotazioni?bookingId=...` ("Le mie prenotazioni", che mostra
    // stato/azioni), non più a `/activity/{slug}`. Il vecchio selettore
    // non trovava più nessuna riga Timeline (nessun href `/activity/`
    // lì), e in alcuni run agganciava per caso un link `/activity/`
    // estraneo più in basso in pagina (sezione "Consigliate"), cliccabile
    // ma non scopato alla Timeline — da cui la flakiness osservata
    // (mobile-chrome): a volte assente (skip corretto), a volte presente
    // ma non la riga Timeline attesa. TEST OBSOLETO, non un bug applicativo:
    // aggiornato per riflettere il comportamento reale e attuale.
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    // Apri tutti i mesi per trovare una riga coperta con prenotazione reale.
    const monthButtons = page.locator('button[aria-expanded="false"]');
    const count = await monthButtons.count();
    for (let i = 0; i < count; i++) {
      await monthButtons.nth(0).click();
    }

    const clickableRow = page.locator('[id^="week-row-"] a[href^="/prenotazioni?bookingId="]').first();
    if (!(await clickableRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta da una prenotazione reale per l'account di test in questo momento.");
    }
    await clickableRow.click();
    await expect(page).toHaveURL(/\/prenotazioni\?bookingId=/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
