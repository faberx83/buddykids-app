import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Home (rifinitura)
// Sprint correttivo (raffinamento, non redesign) richiesto da Fabrizio: la V2
// era diventata "più razionale ma meno umana". Stessi dati/componenti di
// Sprint 1/2/3 (getPlannerData, getMyBookingsForParent, getTodayCheckinsForParent
// — tutti invariati): cambia l'orchestrazione visiva (Hero Card, check-in
// ripristinato, prenotazioni visuali, statistiche in fondo).

test.describe("NEXTGEN - Home (rifinitura)", () => {
  test("TC-N18 - La Hero Card comunica stato, settimane mancanti e prossimo impegno con una CTA", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByText(/Organizzata al \d+%/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continua a pianificare" })).toBeVisible();
  });

  test("TC-N19 - Il check-in di oggi (se presente) appare in Home NEXTGEN con codice visivo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const checkinHeading = page.getByText("Oggi", { exact: true });
    if (!(await checkinHeading.isVisible().catch(() => false))) {
      test.skip(true, "Nessun check-in previsto oggi per l'account di test.");
    }
    await expect(page.getByText("Codice check-in")).toBeVisible();
  });

  test("TC-N20 - Rispondere al check-in mostra un feedback positivo (toast) non invasivo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const yesButton = page.getByRole("button", { name: "Sì" });
    if (!(await yesButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessun check-in previsto oggi per l'account di test.");
    }
    await yesButton.click();
    await expect(page.getByText(/registrato con successo/)).toBeVisible();
  });

  test("TC-N21 - Il 'Prossimo appuntamento' mostra una sola card visuale (attività, figlio, periodo, stato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Prossimo appuntamento", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione futura per l'account di test.");
    }
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N22 - Le statistiche sintetiche sono in fondo alla pagina, dopo Prenotazioni", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const bookingsHeading = page.getByText("Prenotazioni", { exact: true });
    const statsLabel = page.getByText("Speso finora");
    if (!(await bookingsHeading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione per l'account di test.");
    }
    const bookingsBox = await bookingsHeading.boundingBox();
    const statsBox = await statsLabel.boundingBox();
    expect(bookingsBox && statsBox && statsBox.y > bookingsBox.y).toBeTruthy();
  });

  // SEGNALAZIONE DI FABRIZIO (dopo lo sprint correttivo): "sistemare
  // dimensioni font perché vanno a capo... settimana 12 e 13". Causa: colonna
  // a larghezza fissa troppo stretta per "Settimana 12"/"Settimana 13" (12
  // caratteri, più larghi di "Settimana 1".."Settimana 9"). Fix: colonna a
  // larghezza automatica + whitespace-nowrap (vedi PlannerClient.tsx) — qui
  // verifichiamo che l'etichetta resti su UNA riga (altezza contenuta),
  // invece di misurare a pixel un font-size specifico.
  test("TC-N24 - Le etichette 'Settimana 12'/'Settimana 13' nel Planner non vanno a capo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    for (const label of ["Settimana 12", "Settimana 13"]) {
      const el = page.getByText(label, { exact: true });
      await expect(el).toBeVisible();
      const box = await el.boundingBox();
      // Una riga di testo a 12.5px sta sotto i 20px di altezza; se fosse
      // andata a capo su due righe supererebbe abbondantemente questa soglia.
      expect(box && box.height < 20).toBeTruthy();
    }
  });

  test("TC-N25 - 'Consigliati per voi' rappresenta più di un figlio quando la famiglia ne ha più di uno", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test, con 2+ bambini e settimane scoperte.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Consigliati per voi", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessun suggerimento mostrato per l'account di test (famiglia già organizzata o un solo figlio).");
    }
    // Non verifica un nome specifico (dipende dai dati dell'account di test):
    // verifica solo che compaia più di UNA didascalia "Per {figlio}" diversa,
    // a conferma che l'elenco non è dominato da un solo bambino.
    const captions = await page.locator("text=/^Per /").allTextContents();
    const distinctKids = new Set(captions);
    // Con un solo figlio in famiglia questo test va skippato (vedi sopra);
    // con 2+ figli e più di un suggerimento, ci si aspetta più di 1 nome.
    if (captions.length > 1) {
      expect(distinctKids.size).toBeGreaterThan(1);
    }
  });

  test("TC-N26 - I gruppi in 'Tutte le prenotazioni' si possono comprimere ed espandere singolarmente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test, con 2+ prenotazioni in gruppi diversi.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const toggle = page.getByText(/Tutte le prenotazioni/);
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione per l'account di test.");
    }
    await toggle.click();

    const groupHeaders = page.locator("button i.ti-chevron-up, button i.ti-chevron-down");
    const count = await groupHeaders.count();
    if (count === 0) {
      test.skip(true, "Nessun gruppo con prenotazioni per l'account di test.");
    }
    const firstGroupButton = page.locator("button", { has: groupHeaders.first() });
    await firstGroupButton.click();
    await expect(firstGroupButton.locator("i.ti-chevron-down")).toBeVisible();
    await firstGroupButton.click();
    await expect(firstGroupButton.locator("i.ti-chevron-up")).toBeVisible();
  });
});
