import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WEEK_STATUS_LABEL } from "@/lib/nextgen/planner-insights";

// Area: TRAMA BETA v1.1 — Planner Overview semplificata (Wave 1 della
// revisione "PLANNER SIMPLIFICATION + BOOKING-AWARE HOME CTA"). Copre i
// requisiti PLN11-01..07 elencati nel prompt di implementazione: max 3
// settimane in "Prossime settimane da completare" (coperte/dismissed/
// passate escluse), un'unica CTA dominante che porta DIRETTAMENTE a Scopri
// (mai al Dettaglio Settimana), nessuna griglia ActivityCard completa in
// Organizzazione, hero di copertura visibile senza scroll/toggle.

test.describe("TRAMA BETA v1.1 — Planner Overview semplificata", () => {
  test("PLN11-01 - 'Prossime settimane da completare' mostra al massimo 3 righe", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByText("Prossime settimane da completare", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana da completare per l'account di test (tutto coperto/passato/non ti serve).");
    }
    // Le righe sono link verso il Dettaglio Settimana
    // (/nextgen/planner/settimana/<data>) — contate quelle, non un
    // selettore generico che potrebbe agganciare altri link della pagina.
    const rows = page.locator('a[href^="/nextgen/planner/settimana/"]').filter({
      has: page.getByText(/^Settimana \d+$/),
    });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
  });

  // Il filtro di getUpcomingWeeks (lib/nextgen/planner-insights.ts) è
  // !covered && !dismissed && !isPast(todayIso): per costruzione lo stato
  // calcolato per queste righe può essere solo "priority" o "uncovered"
  // (mai "covered"/"partial"/"conflict"/"awaiting"/"dismissed"/"past" — vedi
  // l'invariante di computeWeekStatus documentato nei commenti della
  // funzione). Verifichiamo quindi che l'etichetta di stato mostrata in
  // ogni riga sia sempre una di quelle due, mai una delle altre.
  test("PLN11-02 - le righe di 'Prossime settimane da completare' escludono sempre settimane coperte/non-ti-servono/passate", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByText("Prossime settimane da completare", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana da completare per l'account di test.");
    }
    const rows = page.locator('a[href^="/nextgen/planner/settimana/"]').filter({
      has: page.getByText(/^Settimana \d+$/),
    });
    const count = await rows.count();
    const allowedLabels = [WEEK_STATUS_LABEL.priority, WEEK_STATUS_LABEL.uncovered];
    const forbiddenLabels = [
      WEEK_STATUS_LABEL.covered,
      WEEK_STATUS_LABEL.partial,
      WEEK_STATUS_LABEL.conflict,
      WEEK_STATUS_LABEL.awaiting,
      WEEK_STATUS_LABEL.dismissed,
      WEEK_STATUS_LABEL.past,
    ];
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).textContent()) ?? "";
      const hasAllowed = allowedLabels.some((label) => text.includes(label));
      const hasForbidden = forbiddenLabels.some((label) => text.includes(label));
      expect(hasAllowed).toBe(true);
      expect(hasForbidden).toBe(false);
    }
  });

  // Una sola CTA dominante per l'Overview (mai due bottoni "Riempi
  // settimana"/CTA acquisitive in contemporanea).
  test("PLN11-03 - un'unica CTA dominante 'Riempi settimana' nell'Overview", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una settimana prioritaria.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const cta = page.getByRole("link", { name: "Riempi settimana" });
    if (!(await cta.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana prioritaria per l'account di test (tutto coperto).");
    }
    await expect(cta).toHaveCount(1);
  });

  // Requisito esplicito della revisione: "NON inserire il Dettaglio
  // Settimana fra Overview e Scopri nel percorso prioritario... Il flusso
  // più frequente resta: Planner → Riempi settimana → Scopri filtrato."
  test("PLN11-04 - la CTA dominante porta DIRETTAMENTE a Scopri, non al Dettaglio Settimana", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una settimana prioritaria.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const cta = page.getByRole("link", { name: "Riempi settimana" });
    if (!(await cta.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana prioritaria per l'account di test.");
    }
    const href = await cta.getAttribute("href");
    expect(href).toMatch(/^\/nextgen\/search\?week=\d{4}-\d{2}-\d{2}$/);

    await cta.click();
    await expect(page).toHaveURL(/\/nextgen\/search\?week=\d{4}-\d{2}-\d{2}/);
  });

  // Requisito esplicito: "Non deve esistere un mini-Scopri in fondo al
  // Planner" — nessuna griglia ActivityCard completa in Organizzazione,
  // solo il teaser leggero "Suggerimenti per te · N".
  test("PLN11-05 - nessuna griglia ActivityCard completa ('Consigliate'/'Per riempire') in Organizzazione", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Consigliate", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Per riempire", { exact: true })).toHaveCount(0);
  });

  // Il teaser apre il Dettaglio Settimana (dove vive il vero suggerimento
  // in evidenza, Wave 2) — non è esso stesso una griglia di risultati.
  test("PLN11-06 - il teaser 'Suggerimenti per te · N' è una singola riga che apre il Dettaglio Settimana", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con suggerimenti disponibili per la settimana prioritaria.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const teaser = page.getByRole("link", { name: /Suggerimenti per te · \d+/ });
    if (!(await teaser.isVisible().catch(() => false))) {
      test.skip(true, "Nessun suggerimento disponibile per la settimana prioritaria dell'account di test.");
    }
    await expect(teaser).toHaveCount(1);
    const href = await teaser.getAttribute("href");
    expect(href).toMatch(/^\/nextgen\/planner\/settimana\/\d{4}-\d{2}-\d{2}$/);
  });

  // Requisito "hero coverage sintesi visibile senza scroll significativo":
  // deve essere il primo contenuto della vista, quindi visibile subito al
  // caricamento, prima di aprire qualunque toggle/sezione.
  test("PLN11-07 - la sintesi di copertura stagionale è visibile immediatamente al caricamento", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/di \d+ settimane coperte/)).toBeVisible();
  });
});
