import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE — Sprint 2, percorso Walkthrough attività (Partner).
//
// Cartella additiva: verifica solo il riuso del motore Walkthrough generico
// (costruito in Sprint 1, vedi lib/walkthrough/*) applicato alla nuova voce
// "activity_creation_partner" (lib/walkthrough/registry.ts) e alla sua unica
// riga di wiring in app/center/one/page.tsx. Nessuna logica nuova nel motore
// stesso: non ri-testiamo qui startWalkthroughStepAction/complete/skip già
// coperti implicitamente da TC-N306/altri test del motore in Sprint 1 — solo
// che la nuova definizione compare e naviga correttamente.
//
// Richiede un browser reale contro un deploy con Supabase configurato e
// l'account center_admin di test con l'override TRAMA_ONE_ENABLED=true
// (DEC-34) — lo stesso già usato da tests/one/onboarding-remediation.spec.ts.

test.describe("TRAMA ONE — Walkthrough attività (Partner, Sprint 2)", () => {
  test("TC-N414 - Partner: /center/one mostra il percorso guidato 'Pubblica la tua prima attività' con il primo step", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account center_admin di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/one");

    await expect(page.getByText("Pubblica la tua prima attività")).toBeVisible();
    await expect(page.getByText("Crea l'attività")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
  });

  test("TC-N415 - Partner: avviare il primo step del percorso attività lo marca come iniziato (persistenza reale, non solo stato locale)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account center_admin di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/one");
    await page.getByRole("button", { name: "Inizia" }).click();
    await expect(page.getByRole("button", { name: "Continua" })).toBeVisible();

    // Ricarico la pagina: se lo stato è davvero persistito su
    // tutorial_progress (e non solo nello useState locale del componente),
    // lo step resta "in_progress" e il bottone "Continua" ricompare invece
    // di tornare a "Inizia".
    await page.reload();
    await expect(page.getByRole("button", { name: "Continua" })).toBeVisible();
  });
});
