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
    // BUG DI TEST CORRETTO: getByLabel non funziona qui perché
    // components/admin/NewCenterForm.tsx non associa <label> e <input> né
    // con htmlFor/id né con nesting (sono elementi fratelli in un <div>) —
    // stesso motivo per cui il resto della suite (es. TC-198) non usa mai
    // getByLabel su questi form, ma getByText(...).locator("..").locator(...)
    // per risalire al div contenitore e trovare l'input fratello.
    // BUG DI TEST CORRETTO (2° giro): new RegExp(`...${centerName}...`) con
    // centerName contenente "[TEST]" veniva interpretato come CLASSE DI
    // CARATTERI regex ([T,E,S,T], un carattere singolo qualunque tra questi),
    // non come testo letterale "[TEST]" — il messaggio di successo era
    // realmente in pagina (confermato via error-context.md di Playwright:
    // "Centro "[TEST] Centro Auto LEAD ..." creato." presente nello snapshot)
    // ma il match falliva sempre per questo motivo, non per un problema del
    // salvataggio. getByText con una stringa fa match letterale (substring),
    // nessuna regex necessaria qui.
    await page.getByText("Nome del centro").locator("..").locator("input").fill(centerName);
    await page.getByRole("button", { name: "Crea centro" }).click();
    await expect(page.getByText(`Centro "${centerName}" creato`)).toBeVisible();

    // Nessun INSERT manuale eseguito qui: se migration_10 (trigger AFTER
    // INSERT su public.centers) funziona, il nuovo centro ha già una riga
    // LEAD in center_onboarding_state e compare subito nella coda Admin.
    await page.goto("/admin/one/onboarding");
    // BUG DI TEST CORRETTO (3° giro): un ".." di troppo — in
    // AdminOnboardingReviewClient.tsx ogni riga è un <div> che contiene
    // DIRETTAMENTE sia il nome del centro sia il badge di stato (un solo
    // livello di nesting, non due). Risalendo di due livelli si atterrava sul
    // contenitore <div className="divide-y..."> che avvolge TUTTE le righe
    // della lista "Altri stati", per questo getByText("Da attivare") dentro
    // trovava 5-7 elementi invece di 1 (strict mode violation) — non un
    // problema del trigger: TC-N408 (idempotenza, stesso centro) passava già
    // con successo, a conferma che la riga LEAD viene creata correttamente.
    const row = page.getByText(centerName).locator("..");
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
    await page.getByText("Nome del centro").locator("..").locator("input").fill(centerName);
    await page.getByRole("button", { name: "Crea centro" }).click();
    await expect(page.getByText(`Centro "${centerName}" creato`)).toBeVisible();

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
