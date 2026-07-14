import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner (Sprint 3)
// Il Planner diventa la feature principale: timeline familiare completa,
// sovrapposizioni, budget impegnato, consigli mirati alla settimana
// prioritaria. Reindirizzato da un link dedicato in Dashboard e da
// NextgenBottomNav (nuovo, solo sotto /nextgen).

test.describe("NEXTGEN - Planner (Sprint 3)", () => {
  test("TC-N13 - /nextgen/planner mostra la timeline completa delle 13 settimane", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/settimane coperte/)).toBeVisible();
    await expect(page.getByText("Timeline della stagione")).toBeVisible();
    await expect(page.getByText("Settimana 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Settimana 13", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N14 - Budget impegnato sempre visibile nel Planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Budget impegnato")).toBeVisible();
  });

  // SPRINT 5.1: TC-N15 aggiornato al testo reale della CTA in Home ("Apri
  // Planner", non più "Apri il planner completo" — testo mai allineato al
  // codice dopo il redesign Hero Card).
  test("TC-N15 - La CTA 'Apri Planner' in Home porta a /nextgen/planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Apri Planner" }).click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
  });

  test("TC-N16 - NextgenBottomNav permette di raggiungere Home/Planner/Scopri in un tocco", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await page.getByRole("link", { name: "Planner" }).click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
    await page.getByRole("link", { name: "Scopri" }).click();
    await expect(page).toHaveURL(/\/nextgen\/search/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  // REBRAND TRAMA Sprint 1: bottom nav a 5 voci (Home/Planner/Scopri/
  // Prenotazioni/Profilo), vedi NextgenBottomNav.tsx. Le ultime due puntano
  // alle pagine LEGACY esistenti (fuori da /nextgen) — tradeoff accettato con
  // Fabrizio finché non avranno una schermata NEXTGEN dedicata.
  test("TC-N88 - NextgenBottomNav include Prenotazioni e Profilo (pagine LEGACY condivise)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await page.getByRole("link", { name: "Prenotazioni" }).click();
    await expect(page).toHaveURL(/\/prenotazioni/);
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Profilo" }).click();
    await expect(page).toHaveURL(/\/profile/);
  });

  // SPRINT CORRETTIVO (feedback Fabrizio): con 5 modalità sempre presenti,
  // "Budget" (4a) resta spesso tagliato fuori dallo schermo — l'utente non
  // sapeva che la riga scorre. PlannerModeTabs ora mostra una sfumatura a
  // destra quando c'è altro contenuto da scorrere, e la nasconde una volta
  // raggiunta la fine dello scroll (vedi componente per il dettaglio).
  test("TC-N91 - I tab del Planner mostrano una sfumatura di scroll quando 'Budget'/'Gruppi' sono fuori schermo", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await page.setViewportSize({ width: 375, height: 700 });
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const scrollContainer = page.locator(".no-scrollbar").first();
    const { scrollWidth, clientWidth } = await scrollContainer.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    test.skip(scrollWidth <= clientWidth + 4, "Su questo viewport i 5 tab entrano già interamente: nulla da scorrere.");

    // All'inizio (scroll a sinistra) la sfumatura destra deve essere visibile...
    const rightFade = page.locator("div.pointer-events-none.absolute.right-0");
    await expect(rightFade).toBeVisible();

    // ...e sparire una volta scrollato fino in fondo.
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(rightFade).toHaveCount(0);
  });

  // SPRINT CORRETTIVO (feedback Fabrizio): "se vado sopra budget direi che
  // deve essere sul rosso" — prima usava trama-orange (stesso tono dei
  // warning), ora red-500 per un allarme più netto e distinguibile.
  test("TC-N92 - Modalità Budget: superare il tetto colora la barra e il testo di rosso (non più arancione)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con spesa già sopra il tetto impostato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Budget" }).click();

    const overBudgetText = page.getByText(/hai superato il budget/);
    if (!(await overBudgetText.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non è sopra il tetto budget impostato.");
    }
    await expect(overBudgetText).toHaveClass(/text-red-500/);
    await expect(overBudgetText).not.toHaveClass(/text-trama-orange/);
  });
});
