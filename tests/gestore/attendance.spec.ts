import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Registro presenze
// Generato da BuddyKids_Test_Case.xlsx - nuova funzionalità: prima d'ora il
// gestore non aveva alcuna visibilità sui bambini/famiglie iscritti (solo
// conteggi aggregati via Richieste Gruppo). Richiede le RLS aggiuntive di
// supabase/migration_06_profilo_esteso_presenze.sql (il centro vede nome
// bambino + contatto genitore SOLO per le prenotazioni della propria
// attività) e la prenotazione "fixture" ricreata da
// tests/cleanup-test-data.mjs (bambino di test iscritto a "Settimana 1"
// dell'attività di test).

test.describe("Gestore - Registro presenze", () => {
  // TC-139 - Elenco partecipanti raggruppato per attività e settimana
  test("TC-139 - il bambino di test compare nella settimana 1 dell'attività di test", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");

    await expect(page.getByText("[TEST] Attività BuddyKids")).toBeVisible();
    await expect(page.getByText("Settimana 1", { exact: false })).toBeVisible();
    await page.getByText("[TEST] Attività BuddyKids").click();

    // Il bambino di test è iscritto (nome reale, non anonimizzato: a
    // differenza dei Gruppi tra famiglie diverse, qui il centro vede i propri
    // iscritti — vedi le RLS aggiuntive in migration_06).
    await expect(page.getByText("[TEST] Bimbo Prova")).toBeVisible();
  });

  // TC-140 - Segnare presente/assente per un giorno specifico persiste
  test("TC-140 - segnare 'Presente' per un giorno persiste dopo reload", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account Gestore di test e la prenotazione fixture (vedi tests/cleanup-test-data.mjs)."
    );
    await loginAs(page, "center_admin");
    await page.goto("/center/attendance");

    await page.getByText("[TEST] Attività BuddyKids").click();

    // Selettore preciso della riga bambino (non un div ancestor qualsiasi):
    // combo di classi usata SOLO dalla riga per-bambino in AttendanceClient.tsx.
    const kidRow = page
      .locator("div.flex.items-center.justify-between")
      .filter({ hasText: "[TEST] Bimbo Prova" });
    const toggleButton = kidRow.getByRole("button", { name: /Presente|Assente/ });
    await expect(toggleButton).toHaveText("Assente"); // stato di default

    await toggleButton.click();
    await expect(toggleButton).toHaveText("Presente");

    await page.reload();
    await page.getByText("[TEST] Attività BuddyKids").click();
    const kidRowAfterReload = page
      .locator("div.flex.items-center.justify-between")
      .filter({ hasText: "[TEST] Bimbo Prova" });
    await expect(kidRowAfterReload.getByRole("button", { name: /Presente|Assente/ })).toHaveText("Presente");

    // Ripristino a "Assente" per non alterare i run successivi (la prenotazione
    // fixture viene comunque ricreata ad ogni run, ma l'appello persiste sulla
    // stessa week_id finché non cambia — meglio lasciare lo stato pulito).
    await kidRowAfterReload.getByRole("button", { name: "Presente" }).click();
  });
});
