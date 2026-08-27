import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { computeBetaInviteCodeState, isBetaInviteCodeRedeemable } from "../../lib/beta-invites/eligibility";

// Codici invito Beta (migration_30_beta_invite_codes.sql, 27/08/2026) — link
// ?beta=CODICE condiviso manualmente da Fabrizio (es. WhatsApp), auto-
// iscrizione alla Controlled Beta Cohort al momento della registrazione
// (trigger handle_new_user() esteso, mai una scrittura client-side diretta).

test.describe("beta-invite-codes eligibility [no browser]", () => {
  const base = { active: true, expiresAt: null, maxRedemptions: null, redeemedCount: 0 };

  test("codice attivo, senza scadenza, senza limite -> redeemable", () => {
    expect(computeBetaInviteCodeState(base)).toBe("redeemable");
    expect(isBetaInviteCodeRedeemable(base)).toBe(true);
  });

  test("codice disattivato -> inactive, anche se non scaduto e non esaurito", () => {
    expect(computeBetaInviteCodeState({ ...base, active: false })).toBe("inactive");
  });

  test("scadenza nel passato -> expired", () => {
    const state = computeBetaInviteCodeState({ ...base, expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(state).toBe("expired");
  });

  test("scadenza non valida -> expired (fail-safe, mai trattata come 'senza scadenza')", () => {
    const state = computeBetaInviteCodeState({ ...base, expiresAt: "not-a-date" });
    expect(state).toBe("expired");
  });

  test("scadenza nel futuro -> redeemable", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(computeBetaInviteCodeState({ ...base, expiresAt: future })).toBe("redeemable");
  });

  test("redeemedCount raggiunge maxRedemptions -> exhausted", () => {
    const state = computeBetaInviteCodeState({ ...base, maxRedemptions: 5, redeemedCount: 5 });
    expect(state).toBe("exhausted");
  });

  test("redeemedCount sotto maxRedemptions -> redeemable", () => {
    const state = computeBetaInviteCodeState({ ...base, maxRedemptions: 5, redeemedCount: 4 });
    expect(state).toBe("redeemable");
  });

  test("priorità: inactive vince su expired/exhausted (controllo active per primo)", () => {
    const state = computeBetaInviteCodeState({
      active: false,
      expiresAt: "2020-01-01T00:00:00.000Z",
      maxRedemptions: 1,
      redeemedCount: 1,
    });
    expect(state).toBe("inactive");
  });
});

// ————————————————————————————————————————————————————————————————————————
// Test funzionali con browser reale — richiedono un deploy con Supabase
// configurato. Non eseguibili in questo sandbox (limite pre-esistente,
// mancano le librerie di sistema per lanciare un browser).
// ————————————————————————————————————————————————————————————————————————
test.describe("Admin — Codici invito Beta [UI]", () => {
  test("Admin può creare, vedere e disattivare un codice di test (mai un codice reale)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account platform admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/beta-invites");

    const testCode = `TESTBETA${Date.now()}`;
    await page.getByPlaceholder("Codice (es. TRAMABETA26)").fill(testCode);
    await page.getByRole("button", { name: "Crea codice" }).click();

    const row = page.getByTestId(`beta-invite-${testCode}`);
    await expect(row).toBeVisible();
    await expect(row.getByText("Attivo e utilizzabile")).toBeVisible();

    await row.getByRole("button", { name: "Disattiva" }).click();
    await expect(row.getByText("Disattivato")).toBeVisible();

    await row.getByRole("button", { name: "Elimina" }).click();
    await expect(row).toHaveCount(0);
  });
});

// ————————————————————————————————————————————————————————————————————————
// Segnalazione OG/social preview (?beta=) — verifica statica del testo
// atteso nei metadata, senza browser (Playwright non fetcha davvero l'HTML
// server-rendered di generateMetadata senza un deploy reale + browser).
// Copertura funzionale end-to-end lasciata al test live sotto.
// ————————————————————————————————————————————————————————————————————————
test.describe("Login page — anteprima social invito Beta [UI]", () => {
  test("?beta=CODICE produce meta Open Graph 'TRAMA — Private Beta' senza il codice nei metadata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale per verificare l'HTML server-rendered (generateMetadata).");
    const testCode = `TESTBETA${Date.now()}`;
    await page.goto(`/auth/login?beta=${testCode}`);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");

    expect(ogTitle).toBe("TRAMA — Private Beta");
    expect(ogDescription).toContain("Organizza attività");
    expect(ogImage).toContain("/og/trama-private-beta.png");
    // Il codice/token NON deve mai comparire nei metadata (requisito esplicito).
    expect(ogTitle).not.toContain(testCode);
    expect(ogDescription).not.toContain(testCode);
    expect(ogImage).not.toContain(testCode);
  });
});
