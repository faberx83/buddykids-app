import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Sprint 6 (NEXTGEN, ultimo dei 6 sprint "punch list" di Fabrizio) —
// feedback visivo al tap/click (feedback Fabrizio: "nessun pulsante NEXTGEN
// ha un feedback al tocco, solo hover, che su mobile non serve a nulla").
// Aggiunte classi Tailwind `active:` (scale o tinta a seconda dello stile
// del pulsante) a circa 100 elementi cliccabili in tutta l'area genitore
// NEXTGEN (app/nextgen/** + components/nextgen/**) — invece di un test per
// ognuno, verifichiamo qui un campione rappresentativo per categoria
// (bottom nav, card Profilo, tab Planner, pillola filtro in Cerca).
test.describe("NEXTGEN Sprint 6 - Feedback visivo al tap", () => {
  test("TC-N293 - Le voci della bottom nav hanno uno stato :active", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.locator('a[href="/nextgen/planner"]')).toHaveClass(/active:scale-90/);
  });

  test("TC-N294 - Una card del Profilo (HubCard) ha uno stato :active", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");

    // La classe active: è sull'inner <div> della card (vedi HubCard.tsx),
    // non sull'<a>/<Link> che la avvolge.
    const card = page.getByRole("link", { name: /Le mie prenotazioni/ }).locator("div").first();
    await expect(card).toHaveClass(/active:bg-black/);
  });

  test("TC-N295 - I tab Organizzazione/Budget del Planner hanno uno stato :active", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByRole("button", { name: "Organizzazione" })).toHaveClass(/active:scale-95/);
  });

  test("TC-N296 - I chip filtro in Cerca (Scopri) hanno uno stato :active", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");

    // Il chip filtro è un <div onClick=...>, non un <button> — stesso
    // pattern xpath già usato altrove in questa suite per raggiungere il
    // contenitore cliccabile a partire dall'etichetta.
    const chip = page
      .getByText("Servizi", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
      .first();
    await expect(chip).toHaveClass(/active:scale-95/);
  });
});
