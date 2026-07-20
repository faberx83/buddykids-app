import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE — Sprint 1 Audit Remediation (migration_10, auto-LEAD).
//
// Cartella additiva, nessuna modifica ai test esistenti. Richiede un browser
// reale contro un deploy con Supabase configurato — NON eseguibile nel
// sandbox Claude. Classificato PENDING LOCAL VERIFICATION: vedi Gate 2 nel
// messaggio di consegna per il comando esatto da eseguire sul Mac, DOPO aver
// applicato migration_10_center_onboarding_auto_lead.sql (Gate 1).
//
// Copre i requisiti funzionali #2, #3, #4 della sezione 10 della
// remediation (creazione nuovo centro, idempotenza, nessun INSERT manuale
// necessario) usando l'unica utenza platform_admin di test disponibile e il
// form reale "+ Nuovo centro" di /admin/centers — nessuna nuova utenza di
// test richiesta per questi due casi.

test.describe("TRAMA ONE — Onboarding Centro: auto-inizializzazione LEAD (Sprint 1 remediation)", () => {
  test("TC-N407 - Admin: creare un nuovo centro lo rende visibile in coda onboarding come 'Da attivare', senza alcun INSERT manuale", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, migration_10 applicata, e l'account platform_admin di test."
    );
    const centerName = `[TEST] Centro Auto LEAD ${Date.now()}`;

    await loginAs(page, "platform_admin");
    await page.goto("/admin/centers");
    await page.getByRole("button", { name: "+ Nuovo centro" }).click();
    await page.getByLabel("Nome del centro").fill(centerName);
    await page.getByRole("button", { name: "Crea centro" }).click();
    await expect(page.getByText(new RegExp(`Centro "${centerName}" creato`))).toBeVisible();

    // Nessun INSERT manuale eseguito qui: se migration_10 (trigger AFTER
    // INSERT su public.centers) funziona, il nuovo centro ha già una riga
    // LEAD in center_onboarding_state e compare subito nella coda Admin.
    await page.goto("/admin/one/onboarding");
    const row = page.getByText(centerName).locator("..").locator("..");
    await expect(row.getByText("Da attivare")).toBeVisible();
  });

  test("TC-N408 - Admin: il centro appena creato compare esattamente una volta in coda, mai duplicato (idempotenza del trigger)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, migration_10 applicata, e l'account platform_admin di test."
    );
    const centerName = `[TEST] Centro Idempotenza ${Date.now()}`;

    await loginAs(page, "platform_admin");
    await page.goto("/admin/centers");
    await page.getByRole("button", { name: "+ Nuovo centro" }).click();
    await page.getByLabel("Nome del centro").fill(centerName);
    await page.getByRole("button", { name: "Crea centro" }).click();
    await expect(page.getByText(new RegExp(`Centro "${centerName}" creato`))).toBeVisible();

    await page.goto("/admin/one/onboarding");
    await page.reload();
    await expect(page.getByText(centerName)).toHaveCount(1);
  });

  test("TC-N409 - Percorso con integrazioni: SUBMITTED -> CHANGES_REQUESTED -> SUBMITTED -> APPROVED", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato. PRECONDIZIONE MANUALE: portare '[TEST] Centro BuddyKids' (o il centro di test collegato a TEST_CENTER_ADMIN_EMAIL) allo stato SUBMITTED prima di eseguire questo test, es.: " +
        "update public.center_onboarding_state set status='SUBMITTED' where center_id = '<id centro di test>'; " +
        "(nessuna riga di audit viene falsificata: la transizione reale CLAIMED->SUBMITTED va comunque eseguita una volta dal Partner via UI per popolare lo storico correttamente; questo reset serve solo a ripartire da SUBMITTED per un secondo giro di test)."
    );

    // Admin richiede modifiche.
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/onboarding");
    await page.getByRole("button", { name: "Richiedi modifiche" }).first().click();
    await expect(page.getByText("Modifiche richieste")).toBeVisible();

    // Partner vede "Integrazioni richieste" e rinvia con la CTA corretta.
    await loginAs(page, "center_admin");
    await page.goto("/center/one/onboarding");
    await expect(page.getByText("Integrazioni richieste")).toBeVisible();
    await page.getByRole("button", { name: "Invia nuovamente per verifica" }).click();
    await expect(page.getByText("In verifica")).toBeVisible();

    // Admin approva definitivamente.
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/onboarding");
    await page.getByRole("button", { name: "Approva" }).first().click();
    await expect(page.getByText("Approvato").first()).toBeVisible();
  });

  test("TC-N411 - Sicurezza: un center_admin di un centro diverso non può leggere/modificare l'onboarding altrui", async () => {
    test.skip(
      true,
      "Richiede una SECONDA utenza center_admin di test associata a un centro DIVERSO da quello di TEST_CENTER_ADMIN_EMAIL — non ancora provisionata in questo progetto (una sola utenza center_admin di test esiste oggi). " +
        "Le policy RLS che questo test verificherebbe (center_id = current_center_id() OR is_platform_admin(), migration_09) non sono state modificate da questa remediation. " +
        "Per attivare questo test: creare un secondo centro e un secondo utente center_admin di test, aggiungere TEST_CENTER_ADMIN_2_EMAIL/PASSWORD a .env.test, poi rimuovere questo skip."
    );
    // Corpo del test lasciato pronto per quando la seconda utenza sarà disponibile:
    // await loginAs(page, "center_admin_2");
    // await page.goto(`/center/one/onboarding?centerId=<id del primo centro>`); // se mai esposto via query param
    // await expect(page.getByText("Non autorizzato")).toBeVisible();
  });

  test("TC-N412 - Partner: /center/one/onboarding senza sessione autenticata reindirizza al login", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await page.goto("/center/one/onboarding");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("TC-N413 - Admin: /admin/one/onboarding senza sessione autenticata reindirizza al login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await page.goto("/admin/one/onboarding");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
