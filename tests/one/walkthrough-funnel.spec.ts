import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { computeWalkthroughFunnel } from "@/lib/walkthrough/funnel";
import type { WalkthroughAdminStepSummary } from "@/lib/walkthrough/data";

// TRAMA ONE Build Sprint 6 — hardening walkthrough (task #418, analytics
// funnel/drop-off). lib/walkthrough/funnel.ts è logica PURA (nessuna I/O):
// testabile con test()/expect() di Playwright senza fixture `page` e senza
// bisogno di un browser reale, stesso principio già stabilito in questo
// sprint per lib/command-center/priority.ts.
//
// Comando: npx playwright test tests/one/walkthrough-funnel.spec.ts --grep "no browser"

function step(key: string, title: string, completed: number, inProgress: number, skipped: number): WalkthroughAdminStepSummary {
  return { key, title, completed, inProgress, skipped };
}

test.describe("Sprint 6 - Walkthrough funnel: computeWalkthroughFunnel (no browser)", () => {
  test("il primo step non ha mai drop-off (nessuno step precedente osservabile)", () => {
    const funnel = computeWalkthroughFunnel([step("welcome", "Benvenuto", 5, 2, 1)]);
    expect(funnel[0].reached).toBe(8);
    expect(funnel[0].dropOffFromPrevious).toBeNull();
    expect(funnel[0].dropOffRatePercent).toBeNull();
  });

  test("uno step successivo con meno utenti raggiunti mostra il drop-off corretto", () => {
    const funnel = computeWalkthroughFunnel([
      step("welcome", "Benvenuto", 8, 0, 0), // 8 raggiunti
      step("profile_check", "Completa il profilo", 3, 2, 0), // 5 raggiunti -> 3 persi
    ]);
    expect(funnel[1].reached).toBe(5);
    expect(funnel[1].dropOffFromPrevious).toBe(3);
    expect(funnel[1].dropOffRatePercent).toBe(37.5); // 3/8 = 37.5%
  });

  test("nessun drop-off quando tutti gli utenti proseguono allo step successivo", () => {
    const funnel = computeWalkthroughFunnel([
      step("welcome", "Benvenuto", 4, 0, 0),
      step("profile_check", "Completa il profilo", 4, 0, 0),
    ]);
    expect(funnel[1].dropOffFromPrevious).toBe(0);
    expect(funnel[1].dropOffRatePercent).toBe(0);
  });

  test("drop-off non è mai negativo anche se un dato incoerente lo suggerirebbe", () => {
    // Caso limite non atteso in produzione (reached[N] > reached[N-1] non
    // dovrebbe accadere per costruzione del motore Walkthrough), ma la
    // funzione pura non deve MAI restituire un drop-off negativo.
    const funnel = computeWalkthroughFunnel([
      step("welcome", "Benvenuto", 2, 0, 0),
      step("profile_check", "Completa il profilo", 5, 0, 0),
    ]);
    expect(funnel[1].dropOffFromPrevious).toBe(0);
  });

  test("step vuoto (0 raggiunti ovunque) non genera divisioni per zero", () => {
    const funnel = computeWalkthroughFunnel([
      step("welcome", "Benvenuto", 0, 0, 0),
      step("profile_check", "Completa il profilo", 0, 0, 0),
    ]);
    expect(funnel[1].dropOffFromPrevious).toBe(0);
    expect(funnel[1].dropOffRatePercent).toBe(0);
  });

  test("funnel a tre step con drop-off progressivo (caso realistico welcome_parent)", () => {
    const funnel = computeWalkthroughFunnel([
      step("welcome", "Benvenuto", 10, 0, 0),
      step("profile_check", "Completa il profilo", 6, 1, 1),
      step("done", "Tutto pronto", 5, 0, 0),
    ]);
    expect(funnel.map((s) => s.reached)).toEqual([10, 8, 5]);
    expect(funnel[1].dropOffFromPrevious).toBe(2);
    expect(funnel[2].dropOffFromPrevious).toBe(3);
  });
});

test.describe("TRAMA ONE — Command Center: funnel Walkthrough (Sprint 6, hardening)", () => {
  test("TC-N613 - Admin: /admin/one mostra il funnel Walkthrough con colonne Raggiunti/Abbandono", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform_admin di test.");

    await loginAs(page, "platform_admin");
    await page.goto("/admin/one");

    await expect(
      page.getByText('Walkthrough "Benvenuto in TRAMA ONE" — avanzamento e funnel (Sprint 6, hardening)')
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Raggiunti" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Abbandono vs step prec." })).toBeVisible();
    // Il conteggio riavvii dipende da migration_20_product_events.sql: se non
    // ancora applicata, il testo esplicita "N/D" invece di un numero — in
    // entrambi i casi il paragrafo informativo deve essere presente.
    await expect(page.getByText(/Percorso ricominciato|Conteggio riavvii non disponibile/)).toBeVisible();
  });
});
