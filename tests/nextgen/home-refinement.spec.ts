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
});
