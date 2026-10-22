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
  // 22/10/2026 (Fabrizio: "come tolgo definitivamente il tutorial spotlight?
  // non ha senso"): con PARENT_UX_FIX_ENABLED (acceso per l'account genitore
  // di test, anteprima interna) il tour "Scopri e prenota" non parte più
  // (app/nextgen/layout.tsx). TC-N625 verifica il nuovo comportamento atteso;
  // TC-N626 (avanzamento del tour) resta come registrazione e si salta: il
  // motore è coperto dal lato Partner (walkthrough-partner.spec.ts) e la
  // definizione del percorso da TC-N627/628 qui sotto.
  test("TC-N625 - Genitore con le correzioni UX: /nextgen/search NON mostra più lo Spotlight (il target resta nel DOM)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test (PARENT_UX_FIX_ENABLED acceso, anteprima interna)."
    );

    await loginAs(page, "parent");
    await page.goto("/nextgen/search");

    const realTarget = page.getByPlaceholder("Cerca per nome…");
    await expect(realTarget).toHaveAttribute("data-spotlight", "search_bar");
    await expect(page.getByRole("dialog", { name: "Cerca un centro estivo" })).toHaveCount(0);
  });

  test("TC-N626 - (tour Genitore ritirato il 22/10/2026) avanzamento dello step con persistenza reale", async () => {
    test.skip(true, "Tour 'Scopri e prenota' ritirato con PARENT_UX_FIX_ENABLED (22/10/2026): motore coperto da walkthrough-partner.spec.ts, percorso da TC-N627/628.");
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
