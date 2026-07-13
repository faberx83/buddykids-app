import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner, Sprint 5.5 "Profilo Famiglia multi-genitore"
// Ultima fase della "famiglia" del PRD Family Planner: più genitori con
// ACCOUNT SEPARATI (es. mamma e papà) possono condividere Indirizzi/"Chi fa
// cosa?"/Condivisione Piano (RLS aggiornata in supabase/schema.sql), tramite
// un sistema di famiglia/invito identico a quello già collaudato per le
// Community (creatore/admin/membro + codice invito). Bambini e prenotazioni
// restano SEMPRE a genitore singolo — invariati.
//
// NOTA: l'ambiente di test dispone di UN SOLO account genitore promosso
// (TEST_PARENT_EMAIL) — non è possibile in questa suite verificare l'intero
// flusso a due account reali (crea da A, entra da B). I test coprono quindi
// il flusso end-to-end raggiungibile da un solo account: creazione,
// visualizzazione codice/membri, codice invalido, uscita. Il flusso "entra
// con un codice valido di un'altra famiglia" andrebbe verificato manualmente
// con due account reali prima del rilascio a Fabrizio.

test.describe("NEXTGEN - Family Planner Sprint 5.5 (Profilo Famiglia multi-genitore)", () => {
  test("TC-N73 - Il link 'Famiglia' è raggiungibile dal Planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("link", { name: /Famiglia/ }).click();

    await expect(page).toHaveURL(/\/nextgen\/planner\/famiglia/);
  });

  test("TC-N74 - Creare una famiglia mostra nome, codice invito e se stessi come 'Creatore'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/famiglia");

    const createButton = page.getByRole("button", { name: "Crea famiglia" });
    if (!(await createButton.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test fa già parte di una famiglia (creata da un run precedente).");
    }
    await page.getByPlaceholder("Nome (es. Famiglia Rossi)").fill("Famiglia Test Playwright");
    await createButton.click();

    await expect(page.getByText("Famiglia creata!")).toBeVisible();
    await expect(page.getByText("Famiglia Test Playwright")).toBeVisible();
    await expect(page.getByText("(Tu)")).toBeVisible();
    await expect(page.getByText("Creatore")).toBeVisible();
  });

  test("TC-N75 - Un codice invito non valido mostra un errore chiaro", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/famiglia");

    const joinInput = page.getByPlaceholder("Codice (es. AB2CD9)");
    if (!(await joinInput.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test fa già parte di una famiglia: il form 'Entra' non è mostrato.");
    }
    await joinInput.fill("ZZZZZZ");
    await page.getByRole("button", { name: "Entra nella famiglia" }).click();

    await expect(page.getByText("Codice non valido. Controlla e riprova.")).toBeVisible();
  });

  test("TC-N76 - Copiare il codice invito mostra conferma 'Copiato!'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test già in una famiglia.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/famiglia");

    const copyButton = page.getByRole("button", { name: "Copia" });
    if (!(await copyButton.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non fa parte di una famiglia (esegui prima TC-N74).");
    }
    await copyButton.click();
    await expect(page.getByText("Copiato!")).toBeVisible();
  });

  test("TC-N77 - Uscire dalla famiglia richiede conferma e torna alla schermata crea/entra", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test già in una famiglia.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/famiglia");

    const leaveLink = page.getByRole("button", { name: "Esci dalla famiglia" });
    if (!(await leaveLink.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non fa parte di una famiglia (esegui prima TC-N74).");
    }
    await leaveLink.click();
    await expect(page.getByText(/Sicuro di voler uscire/)).toBeVisible();
    await page.getByRole("button", { name: "Sì, esci" }).click();

    await expect(page.getByText("Hai lasciato la famiglia")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crea famiglia" })).toBeVisible();
  });
});
