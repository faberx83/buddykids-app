import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline + Stato per
// settimana): raggruppamento della Timeline per mese, righe con
// prenotazione attiva cliccabili verso la scheda attività, date della
// settimana mostrate al click su "Stato per settimana".

test.describe("NEXTGEN - Planner Organizzazione, Sprint 2 (Timeline mensile)", () => {
  // PLANNER BETA v1.1 (Wave 1) — la Timeline non è più visibile di default:
  // aperta esplicitamente tramite "Vedi tutte le settimane" prima di
  // verificare il raggruppamento per mese (contenuto/comportamento interno
  // invariato).
  test("TC-271 - La Timeline (Vedi tutte le settimane) è raggruppata per mese, pieghevole", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();

    await expect(page.getByText(/Timeline della stagione/)).toBeVisible();
    // Almeno un'intestazione di mese (Giugno/Luglio/Agosto/Settembre — la
    // stagione tipo copre metà giugno-metà settembre, vedi season-weeks.ts).
    const monthHeader = page.getByText(/Giugno|Luglio|Agosto|Settembre/).first();
    await expect(monthHeader).toBeVisible();
  });

  // PLANNER BETA v1.1 (Wave 1, punto 2B) — la striscia compatta "Stato per
  // settimana" che generava l'azione qui testata è stata RIMOSSA (grep
  // eseguito su tutto app/nextgen prima di rimuoverla, vedi commento in
  // PlannerClient.tsx#jumpToWeek: nessun altro punto del prodotto dipendeva
  // da essa). jumpToWeek(index) resta, ma l'unico chiamante rimasto è
  // l'azione "week" degli alert unificati (allAlerts — es. il promemoria
  // "La Settimana N è la prossima da organizzare/è ancora scoperta",
  // computePriorityWeekReminder in lib/nextgen/reminders.ts). Questo test
  // sostituisce TC-272 esercitando quel percorso reale: click sull'alert →
  // la Timeline si apre da sé (timelineOpen), il mese giusto si espande e
  // la riga corrispondente viene evidenziata.
  test("TC-272 - Cliccare l'alert 'settimana prioritaria' apre la Timeline, il mese giusto ed evidenzia la riga", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test con una settimana prioritaria imminente (entro 14 giorni).");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const alertPattern = /La Settimana (\d+) (inizia tra|\(tra)/;
    let alertButton = page.getByRole("button", { name: alertPattern }).first();
    if (!(await alertButton.isVisible().catch(() => false))) {
      // SPRINT 7 — un solo alert mostrato di default: se quello prioritario
      // non è il più urgente, va rivelato con "Mostra tutti".
      const showAll = page.getByRole("button", { name: /Mostra tutti/ });
      if (await showAll.isVisible().catch(() => false)) {
        await showAll.click();
        alertButton = page.getByRole("button", { name: alertPattern }).first();
      }
    }
    if (!(await alertButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana prioritaria imminente (entro 14 giorni) per l'account di test in questo momento.");
    }

    const alertText = await alertButton.textContent();
    const weekIndex = alertText?.match(/Settimana (\d+)/)?.[1];
    expect(weekIndex).toBeDefined();

    await alertButton.click();

    // jumpToWeek apre la Timeline (prima nascosta), espande il mese e
    // scrolla/evidenzia la riga — la riga bersaglio deve quindi esistere ed
    // essere visibile nel DOM subito dopo il click.
    await expect(page.getByText(/Timeline della stagione/)).toBeVisible();
    const row = page.locator(`#week-row-${weekIndex}`);
    await expect(row).toBeVisible();
    // L'anello di evidenziazione (ring-2 ring-trama-violet) è temporaneo
    // (sparisce dopo 1.6s, vedi jumpToWeek) — verificato subito dopo il click.
    await expect(row).toHaveClass(/ring-trama-violet/);
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
    // PLANNER BETA v1.1 (Wave 1) — la Timeline è dietro "Vedi tutte le
    // settimane" (timelineOpen, default chiuso): va aperta prima di poter
    // aprire i singoli mesi. Il vecchio selettore generico
    // 'button[aria-expanded="false"]' ora aggancerebbe anche gli altri
    // toggle nuovi di questa wave (lo stesso "Vedi tutte le settimane",
    // "Copertura per bambino", "Calendario e Chi fa cosa?"), non più solo i
    // mesi — sostituito con un selettore scoped al nome dei mesi.
    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();

    // Apri tutti i mesi per trovare una riga coperta con prenotazione reale.
    const monthButtons = page.getByRole("button", { name: /Giugno|Luglio|Agosto|Settembre/ });
    const count = await monthButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = monthButtons.nth(i);
      if ((await btn.getAttribute("aria-expanded")) === "false") {
        await btn.click();
      }
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
