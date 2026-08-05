import { test, expect } from "@playwright/test";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { getBetaEnabledFlagNames, groupCatalogByStatus, FEATURE_CATALOG } from "../../lib/feature-registry/catalog";

// TRAMA ONE — Addendum Sezione B (Feature Control Center completo, 05/08).
// Prima parte: test puri, nessun browser (stesso pattern di
// tests/one/feature-flags.spec.ts) per lib/feature-registry/catalog.ts.

test.describe("TRAMA ONE — Feature Control Center: catalogo [no browser]", () => {
  test("TC-N612 - getBetaEnabledFlagNames() dedup risolve a TRAMA_ONE_ENABLED", () => {
    const names = getBetaEnabledFlagNames();
    expect(names).toContain("TRAMA_ONE_ENABLED");
    // Oggi un solo flag governa voci BETA_ENABLED: nessun duplicato.
    expect(new Set(names).size).toBe(names.length);
  });

  test("TC-N613 - ogni voce del catalogo ha uno status tra i 9 valori tipizzati", () => {
    const grouped = groupCatalogByStatus();
    const validStatuses = Object.keys(grouped);
    for (const entry of FEATURE_CATALOG) {
      expect(validStatuses).toContain(entry.status);
    }
  });

  test("TC-N614 - le voci MOCK_DEMO con demoBannerRequired hanno riskLevel 'high'", () => {
    // Coerenza interna del catalogo: se richiediamo un banner all'utente,
    // deve essere perché il rischio è dichiarato alto, non un'accoppiata
    // arbitraria tra i due campi.
    const flagged = FEATURE_CATALOG.filter((e) => e.demoBannerRequired);
    expect(flagged.length).toBeGreaterThan(0);
    for (const entry of flagged) {
      expect(entry.status).toBe("MOCK_DEMO");
      expect(entry.riskLevel).toBe("high");
    }
  });
});

// Seconda parte: E2E reale (richiede TEST_SCOPE con Supabase configurato e
// account platform_admin) — non eseguibile in questo sandbox (Chromium
// senza dipendenze di sistema), verificabile da Fabrizio col prossimo
// test-deploy.sh/deploy.sh.
test.describe("TRAMA ONE — Feature Control Center: azioni batch [UI]", () => {
  test("TC-N615 - i controlli batch Beta sono visibili e lo scope globale richiede conferma testuale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform_admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/feature-flags");

    await expect(page.getByText("Azioni batch — funzionalità Beta")).toBeVisible();
    await expect(page.getByRole("button", { name: "Attiva tutte le funzionalità Beta pronte" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disattiva tutte le funzionalità Beta (rollback)" })).toBeVisible();

    // Scope di default è "global" (primo tra gli scope ammessi) -> deve
    // comparire il campo di conferma testuale, non un select di scopeValue.
    await expect(page.getByPlaceholder('Scrivi "GLOBAL" per confermare')).toBeVisible();

    // Click senza aver scritto "GLOBAL": deve bloccare l'azione con un
    // messaggio d'errore, non procedere silenziosamente.
    await page.getByRole("button", { name: "Attiva tutte le funzionalità Beta pronte" }).click();
    await expect(page.getByText(/scrivi.*GLOBAL/i)).toBeVisible();
  });
});
