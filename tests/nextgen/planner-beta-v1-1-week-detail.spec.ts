import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: TRAMA BETA v1.1 — Dettaglio Settimana (Wave 2 della revisione),
// nuova route additiva /nextgen/planner/settimana/[startDate]. Copre
// PLN11-W01..W04: 404 su startDate non valido, CTA booking-aware per
// settimana coperta/scoperta, alternative in forma compatta.

test.describe("TRAMA BETA v1.1 — Dettaglio Settimana", () => {
  test("PLN11-W01 - uno startDate che non corrisponde a nessuna SeasonWeek restituisce 404", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    const response = await page.goto("/nextgen/planner/settimana/2099-01-01");
    // Next.js notFound() renderizza la pagina 404 con status 404.
    expect(response?.status()).toBe(404);
  });

  // Il Dettaglio Settimana non è mai raggiunto da un link diretto per una
  // settimana coperta nel flusso principale (la riga Timeline coperta porta
  // a "Le mie prenotazioni", non lì) — per testare la route stessa
  // ricaviamo lo startDate ISO dalla riga Timeline coperta, che espone
  // l'anno stagionale ("Timeline della stagione — Estiva <anno>") e il
  // range date della settimana nel formato "D–D/M" (vedi lib/data/planner.ts
  // formatShortRange), e navighiamo direttamente lì per verificare che la
  // route rispetti il requisito "settimana già coperta -> mai una nuova
  // acquisizione proposta".
  test("PLN11-W02 - settimana già coperta: CTA 'Vai alla prenotazione', mai una nuova acquisizione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();
    const seasonHeading = await page.getByText(/Timeline della stagione/).textContent();
    const year = seasonHeading?.match(/Estiva (\d{4})/)?.[1];
    expect(year).toBeDefined();

    const monthButtons = page.getByRole("button", { name: /Giugno|Luglio|Agosto|Settembre/ });
    const monthCount = await monthButtons.count();
    for (let i = 0; i < monthCount; i++) {
      const btn = monthButtons.nth(i);
      if ((await btn.getAttribute("aria-expanded")) === "false") await btn.click();
    }
    const coveredRow = page.locator('[id^="week-row-"]').filter({
      has: page.locator('a[href^="/nextgen/prenotazioni?bookingId="]'),
    }).first();
    if (!(await coveredRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta da una prenotazione reale per l'account di test.");
    }
    const rangeText = await coveredRow.locator("div").filter({ hasText: /\d+.\d+\/\d+/ }).first().textContent();
    const rangeMatch = rangeText?.match(/(\d+).\s*(\d+)\/(\d+)/);
    expect(rangeMatch).not.toBeNull();
    const [, startDay, , month] = rangeMatch ?? [];
    const startDate = `${year}-${month.padStart(2, "0")}-${startDay.padStart(2, "0")}`;

    await page.goto(`/nextgen/planner/settimana/${startDate}`);
    await expect(page.getByRole("link", { name: "Vai alla prenotazione" })).toBeVisible();
    // Nessun suggerimento/griglia di nuove attività per una settimana già coperta.
    await expect(page.getByText("Suggerimento principale", { exact: true })).toHaveCount(0);
  });

  test("PLN11-W03 - settimana scoperta: suggerimento principale presente se esistono match compatibili", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una settimana prioritaria e suggerimenti disponibili.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const teaser = page.getByRole("link", { name: /Suggerimenti per te · \d+/ });
    if (!(await teaser.isVisible().catch(() => false))) {
      test.skip(true, "Nessun suggerimento disponibile per la settimana prioritaria dell'account di test.");
    }
    await teaser.click();
    await expect(page.getByText("Suggerimento principale", { exact: true })).toBeVisible();
    // Nessuna CTA 'Vai alla prenotazione' per una settimana ancora scoperta.
    await expect(page.getByRole("link", { name: "Vai alla prenotazione" })).toHaveCount(0);
  });

  test("PLN11-W04 - le alternative sono righe compatte (non ActivityCard piene)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con più di un suggerimento disponibile per la settimana prioritaria.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const teaser = page.getByRole("link", { name: /Suggerimenti per te · \d+/ });
    if (!(await teaser.isVisible().catch(() => false))) {
      test.skip(true, "Nessun suggerimento disponibile per la settimana prioritaria dell'account di test.");
    }
    await teaser.click();

    const altHeading = page.getByText("Altre opzioni", { exact: true });
    if (!(await altHeading.isVisible().catch(() => false))) {
      test.skip(true, "Un solo suggerimento disponibile: nessuna alternativa da mostrare in forma compatta.");
    }
    // Riga compatta: titolo + prezzo/match, non una ActivityCard piena
    // (che include immagine di copertina/rating/descrizione).
    const compactRow = page.locator('a[href^="/activity/"]').filter({ hasText: "/sett." }).first();
    await expect(compactRow).toBeVisible();
    await expect(page.getByText("Vedi tutte in Scopri", { exact: true })).toBeVisible();
  });
});
