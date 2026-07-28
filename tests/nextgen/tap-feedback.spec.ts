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

    // href="/nextgen/planner" compare due volte in Home: la card CTA nel
    // contenuto (active:scale-[0.97]) e il link della bottom nav
    // (active:scale-90) — strict mode violation trovata nel run reale del
    // 28/07 (Gate C Cluster A). app/nextgen/layout.tsx renderizza
    // {children} PRIMA di <NextgenBottomNav/>, quindi .last() è sempre il
    // link di nav.
    await expect(page.locator('a[href="/nextgen/planner"]').last()).toHaveClass(/active:scale-90/);
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

    // Gate C (28/07): il chip filtro è un <div onClick=...> il cui UNICO
    // figlio di testo è "Servizi" stesso (SearchDiscoveryClient.tsx righe
    // 495-505: icona <i> senza testo + {f.label} diretto, nessuno <span>
    // di incapsulamento) — getByText risolve quindi GIÀ al div cliccabile
    // stesso (cursor-pointer/active:scale-95 sono sue classi dirette).
    // L'xpath `ancestor::` precedente cercava un ANTENATO più in alto con
    // quella classe (l'asse ancestor esclude il nodo di contesto stesso),
    // che non esiste — 0 risultati, locator vuoto, assert in timeout.
    // HARNESS, non bug applicativo.
    const chip = page.getByText("Servizi", { exact: true });
    await expect(chip).toHaveClass(/active:scale-95/);
  });
});
