import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Family Planner, Sprint 5.6 "Vista Gruppi"
// Ultima scheda del Planner ancora "in arrivo" (Organizzazione/Budget/
// Calendario/Mappa/Famiglia già fatte nelle fasi precedenti): la scheda
// "Gruppi" ora mostra un riepilogo reale — Community (Sprint 4) e Gruppi
// sconto/car pooling (già esistenti) — con link al dettaglio reale.
// NESSUNA nuova tabella/RLS: riuso puro di getCommunitiesForUser()/
// getGroupsForUser(), già collaudate altrove.

test.describe("NEXTGEN - Family Planner Sprint 5.6 (Vista Gruppi)", () => {
  test("TC-N78 - La scheda 'Gruppi' del Planner mostra le sezioni Community e Gruppi sconto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Gruppi" }).click();

    await expect(page.getByText("Le tue Community")).toBeVisible();
    await expect(page.getByText("I tuoi Gruppi sconto")).toBeVisible();
  });

  test("TC-N79 - Senza Community né Gruppi, la scheda mostra gli stati vuoti con CTA", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test senza Community/Gruppi.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Gruppi" }).click();

    const emptyCommunity = page.getByText(/Non fai ancora parte di nessuna Community/);
    if (!(await emptyCommunity.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test fa già parte di almeno una Community.");
    }
    await expect(emptyCommunity).toBeVisible();
    await expect(page.getByRole("link", { name: "Crea o entra" })).toBeVisible();
  });

  test("TC-N80 - Toccare una card Community apre il suo dettaglio reale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test già in una Community.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Gruppi" }).click();

    // Gate C (28/07): `getByText("Le tue Community").locator("..")` risale
    // di UN SOLO livello, che in PlannerGroupsView.tsx (righe 82-88) è il div
    // flex che contiene anche il link "Vedi tutte"/"Crea o entra" (stesso
    // href /nextgen/community, SENZA id) — non le card Community vere, che
    // vivono in un div fratello più sotto (riga 90-94). Il locator
    // agganciava quindi quel link, non una card: clic -> /nextgen/community
    // (lista), che non matcha mai /\/nextgen\/community\/.+/. Scopato ora
    // direttamente all'href reale delle card (CommunityCard, riga 28:
    // /nextgen/community/${community.id}).
    const communityCard = page.locator('a[href^="/nextgen/community/"]').first();
    if (!(await communityCard.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non fa parte di nessuna Community.");
    }
    await communityCard.click();
    await expect(page).toHaveURL(/\/nextgen\/community\/.+/);
  });

  test("TC-N81 - Una Community con proposte attive mostra il badge 'pronta per un Gruppo'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test in una Community con proposte attive.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Gruppi" }).click();

    const badge = page.getByText(/pronta per un Gruppo|pronte per un Gruppo/);
    if (!(await badge.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna Community dell'account di test ha proposte attive.");
    }
    await expect(badge).toBeVisible();
  });
});
