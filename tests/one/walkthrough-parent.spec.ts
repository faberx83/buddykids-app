import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { WALKTHROUGH_REGISTRY } from "../../lib/walkthrough/registry";

// TRAMA ONE Parent Spotlight sprint (24/08/2026) — equivalente lato Genitore
// di tests/one/walkthrough-partner.spec.ts: stesso motore reale
// (components/spotlight/SpotlightEngine.tsx, estratto in questo sprint da
// PartnerSpotlight.tsx), nuovo percorso "discover_book_parent" (registry.ts)
// montato in app/nextgen/layout.tsx via components/spotlight/
// ParentSpotlight.tsx. Copertura E2E volutamente più leggera di quella
// Partner: verifica l'ancoraggio reale del primo step (stesso pattern di
// TC-N414) — i passi successivi (filtro settimana, apertura scheda,
// prenotazione, nav Planner) dipendono da dati reali (attività prenotabili
// nel centro di test) che Fabrizio verificherà dal vivo, come da governance
// concordata per questo sprint.
//
// Richiede un browser reale contro un deploy con Supabase configurato e
// l'account genitore di test con l'override TRAMA_ONE_ENABLED=true (DEC-34,
// stessa Controlled Beta Cohort già usata lato Partner).

test.describe("TRAMA ONE — Spotlight reale Genitore (Controlled Beta, §7-14)", () => {
  test("TC-N625 - Genitore: /nextgen/search mostra lo Spotlight reale ancorato alla barra di ricerca, non una card scollegata", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "parent");
    await page.goto("/nextgen/search");

    // Il target reale esiste nel DOM (data-spotlight, vedi
    // app/nextgen/search/SearchDiscoveryClient.tsx) — non un doppione del tour.
    const realTarget = page.getByPlaceholder("Cerca per nome…");
    await expect(realTarget).toHaveAttribute("data-spotlight", "search_bar");

    // Il popover è un dialog ANCORATO a quel target (lib/spotlight/
    // position.ts, stesso motore del lato Partner), non una card fissa
    // altrove nella pagina.
    const dialog = page.getByRole("dialog", { name: "Cerca un centro estivo" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Passo 1 di 5")).toBeVisible();
    await expect(
      dialog.getByText("Scrivi un nome o una zona per iniziare a cercare tra le attività disponibili.")
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Inizia" })).toBeVisible();
  });

  test("TC-N626 - avviare lo step ('Inizia') e cliccare il target reale (barra di ricerca) fa avanzare al passo successivo ('Filtra per settimana'), con persistenza reale", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await page.getByRole("dialog", { name: "Cerca un centro estivo" }).getByRole("button", { name: "Inizia" }).click();

    // Click GENUINO sulla barra di ricerca reale (non un bottone "Continua"
    // dentro il popover) — stesso principio del motore Partner (TC-N416).
    await page.getByPlaceholder("Cerca per nome…").click();

    const filterDialog = page.getByRole("dialog", { name: "Filtra per settimana" });
    await expect(filterDialog).toBeVisible();
    await expect(filterDialog.getByRole("button", { name: "Inizia" })).toHaveCount(0); // si avvia da solo, DEC-72

    // Ricarico: se lo stato è davvero persistito su tutorial_progress (non
    // solo useState locale), lo step "filter_week" resta corrente.
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Filtra per settimana" })).toBeVisible();
  });
});

// Verifica "no browser" della definizione del percorso: gira sempre, anche
// in questo sandbox senza browser reale — stesso pattern di
// tests/one/walkthrough-partner.spec.ts (blocco finale) e
// tests/one/spotlight-position.spec.ts.
test.describe("TRAMA ONE — registry Walkthrough Genitore [no browser]", () => {
  test("TC-N627 - discover_book_parent ha 5 step nell'ordine atteso, ciascuno con un target Spotlight reale", () => {
    const definition = WALKTHROUGH_REGISTRY.discover_book_parent;
    expect(definition).toBeTruthy();
    expect(definition.steps.map((s) => s.key)).toEqual([
      "search_activity",
      "filter_week",
      "open_activity",
      "book_activity",
      "planner_nav",
    ]);
    for (const step of definition.steps) {
      expect(step.spotlightTarget).toBeTruthy();
      expect(step.spotlightRoute).toBeTruthy();
    }
  });

  test("TC-N628 - nessuno step di discover_book_parent usa spotlightMissingHint (nessun target vive su un'altra pagina)", () => {
    const definition = WALKTHROUGH_REGISTRY.discover_book_parent;
    for (const step of definition.steps) {
      expect(step.spotlightMissingHint).toBeUndefined();
    }
  });
});
