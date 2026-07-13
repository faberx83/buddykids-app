import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner, Sprint 5.3
// Terza fase del PRD "Family Planner": "Logistica leggera" (indirizzi di
// famiglia), "Chi fa cosa?" (assegnazione leggera per bambino/settimana,
// versione a etichetta libera — NON il sistema multi-genitore completo,
// deliberatamente rimandato allo Sprint 5.5 dedicato) e "Condivisione Piano"
// (link pubblico di sola lettura, senza login, per mese o singola settimana
// — nessun periodo personalizzato in questa fase). Nessuna nuova query
// pesante: Indirizzi/Chi fa cosa/Condivisione riusano le stesse SeasonWeek e
// bambini già letti da app/nextgen/planner/page.tsx.

test.describe("NEXTGEN - Family Planner Sprint 5.3 (Logistica/Chi fa cosa/Condivisione)", () => {
  test("TC-N56 - Il link 'Indirizzi di famiglia' è raggiungibile dal Planner e apre 4 schede indirizzo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("link", { name: /Indirizzi di famiglia/ }).click();

    await expect(page).toHaveURL(/\/nextgen\/planner\/indirizzi/);
    await expect(page.getByText("Casa", { exact: true })).toBeVisible();
    await expect(page.getByText("Altro", { exact: true }).first()).toBeVisible();
  });

  test("TC-N57 - Salvare un indirizzo mostra un conferma e il link 'Apri in Maps'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/indirizzi");

    const input = page.getByPlaceholder("Via, città...").first();
    await input.fill("Via Roma 1, Milano");
    await page.getByRole("button", { name: "Salva" }).first().click();

    await expect(page.getByText("Indirizzo salvato!")).toBeVisible();
    await expect(page.getByLabel("Apri in Maps").first()).toBeVisible();
  });

  test("TC-N58 - Rimuovere un indirizzo salvato torna alla modalità di modifica", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno un indirizzo già salvato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner/indirizzi");

    const removeButton = page.getByLabel("Rimuovi").first();
    if (!(await removeButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessun indirizzo già salvato per l'account di test.");
    }
    await removeButton.click();
    await expect(page.getByText("Indirizzo rimosso")).toBeVisible();
    await expect(page.getByPlaceholder("Via, città...").first()).toBeVisible();
  });

  test("TC-N59 - Nel riepilogo settimana del Calendario, un bambino senza assegnazione mostra 'Nessuno assegnato'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();

    await expect(page.getByText("Nessuno assegnato").first()).toBeVisible();
  });

  test("TC-N60 - 'Chi fa cosa?': assegnare un'opzione predefinita (es. Partner) aggiorna subito il badge", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();

    const assignButton = page.getByText("Nessuno assegnato").first();
    if (!(await assignButton.isVisible().catch(() => false))) {
      test.skip(true, "Bambino già assegnato per questa settimana nell'account di test.");
    }
    await assignButton.click();
    await page.getByRole("button", { name: /Partner/ }).click();

    await expect(page.getByText("Assegnato!")).toBeVisible();
  });

  test("TC-N61 - 'Chi fa cosa?': l'opzione 'Altro' richiede un testo libero prima di confermare", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();

    const badge = page.locator("button", { hasText: /Nessuno assegnato|✓/ }).first();
    await badge.click();

    const okButton = page.getByRole("button", { name: "OK" });
    await expect(okButton).toBeDisabled();
    await page.getByPlaceholder("Altro: scrivi chi (es. Zia Carla)").fill("Zia Carla");
    await expect(okButton).toBeEnabled();
  });

  test("TC-N62 - Vista Mese: 'Condividi {mese}' apre il pannello di creazione link e mostra l'URL dopo la conferma", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const shareButton = page.getByRole("button", { name: /Condividi .+ \d{4}/ });
    if (!(await shareButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana in stagione nel mese corrente per l'account di test.");
    }
    await shareButton.click();

    await expect(page.getByText("Condividi piano")).toBeVisible();
    await page.getByRole("button", { name: "Crea link" }).click();

    await expect(page.getByText("Link pronto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copia" })).toBeVisible();
  });

  test("TC-N63 - Un link creato compare in 'I tuoi link condivisi' e può essere revocato", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();

    const shareButton = page.getByRole("button", { name: /Condividi .+ \d{4}/ });
    if (!(await shareButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana in stagione nel mese corrente per l'account di test.");
    }
    await shareButton.click();
    await page.getByRole("button", { name: "Crea link" }).click();
    await expect(page.getByText("Link pronto")).toBeVisible();
    await page.getByRole("button", { name: "Fatto" }).click();

    await expect(page.getByText("I tuoi link condivisi")).toBeVisible();
    await page.getByRole("button", { name: "Revoca" }).first().click();
    await expect(page.getByText("Link revocato")).toBeVisible();
  });

  test("TC-N64 - La pagina pubblica di condivisione con un token inesistente mostra 'Link non disponibile', senza richiedere login", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await page.goto("/share/planner/token-inesistente-di-prova");

    await expect(page.getByText("Link non disponibile")).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
