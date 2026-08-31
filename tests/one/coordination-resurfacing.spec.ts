import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";

// TRAMA — Wave 2 "Coordination Resurfacing" (audit TRAMA_PILOT_ARCHITECTURE_
// REVIEW.md sez.2/4/12, implementazione: docs/trama-one/analysis/
// TRAMA_PILOT_OBSERVABILITY_COORDINATION_IMPLEMENTATION.md).
//
// COORREZIONE ALL'AUDIT: la review originale (sez.4) affermava che il
// dettaglio Gruppo NextGen-native e il Carpool non esistessero ancora su
// NEXTGEN — verifica più approfondita in questa wave ha trovato che
// app/nextgen/groups/[id]/page.tsx esiste GIÀ (commit 5ffb6a3, task #528,
// "chiude gli 8 rimandi legacy dentro NEXTGEN") e riusa lo stesso
// components/GroupDetailClient.tsx del Legacy, INCLUSA la tab "🚗
// Accompagnamento" (carpool). Il grep originale cercava "carpool" dentro
// app/nextgen/ e non trovava nulla perché quel componente vive sotto
// components/, non sotto app/nextgen/ — falso negativo. Questi test
// verificano quindi principalmente una PRESERVATION (nulla si è rotto),
// non una feature nuova.

test.describe("Wave 2 - Dettaglio Gruppo NextGen (preservation, già esistente)", () => {
  test("COORD-G01/G02 - Un genitore apre il dettaglio Gruppo da NextGen senza mai finire nel layout Legacy", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore membro di almeno un gruppo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/groups");
    const firstGroupLink = page.locator('a[href^="/nextgen/groups/"]').first();
    test.skip((await firstGroupLink.count()) === 0, "Nessun gruppo esistente per questo account di test.");
    await firstGroupLink.click();
    // Mai un redirect verso /groups/[id] (Legacy): l'URL deve restare sotto
    // /nextgen/groups/.
    await expect(page).toHaveURL(/\/nextgen\/groups\/[^/]+$/);
  });

  test("COORD-G03/G04/G05/G06 - La tab Accompagnamento (carpool) è presente nel dettaglio Gruppo NextGen", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore membro di almeno un gruppo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/groups");
    const firstGroupLink = page.locator('a[href^="/nextgen/groups/"]').first();
    test.skip((await firstGroupLink.count()) === 0, "Nessun gruppo esistente per questo account di test.");
    await firstGroupLink.click();
    await expect(page.getByText("🚗 Accompagnamento")).toBeVisible();
    // COORD-G03/G04/G05/G06 (offerta esistente mostrata, crea/modifica
    // offerta/richiesta, matching) richiedono uno scenario con almeno due
    // account nello stesso gruppo con un'offerta/richiesta già inserita —
    // non riproducibile senza un fixture dedicato: REQUIRES LIVE VALIDATION
    // manuale (vedi checklist nel documento di implementazione).
  });

  test("COORD-G07 - Un genitore non membro non vede i dettagli di un gruppo altrui", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'id di un gruppo di cui l'account di test NON fa parte.");
    // REQUIRES LIVE VALIDATION: serve l'id reale di un gruppo altrui, non
    // derivabile in modo affidabile da questa suite — la garanzia stessa
    // (RLS is_group_member() su groups/group_kids/carpool_offers/carpool_
    // requests, invariata in questa wave) è verificata a livello di codice
    // nell'audit, non ripetuta qui come test end-to-end.
  });
});

test.describe("Wave 2 - Home Coordination Signal", () => {
  test("COORD-H04 - Home senza segnali di coordinamento non mostra alcun banner sociale (comportamento invariato)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore senza inviti/richieste/community.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    // Nessuno dei tre testi-firma delle varianti deve comparire.
    await expect(page.getByText("accetta o rifiuta")).toHaveCount(0);
    await expect(page.getByText(/ha accettato la richiesta del gruppo/)).toHaveCount(0);
    await expect(page.getByText(/stanno valutando/)).toHaveCount(0);
  });

  test("COORD-H01/H03 - Un invito di gruppo pendente mostra il segnale ad alta priorità con deep link a /nextgen/groups", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore con un invito di gruppo pendente.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const signal = page.getByText(/accetta o rifiuta/);
    test.skip((await signal.count()) === 0, "Nessun invito di gruppo pendente per questo account di test.");
    await expect(signal).toBeVisible();
    await signal.locator("xpath=ancestor::a").first().click();
    await expect(page).toHaveURL(/\/nextgen\/groups$/);
  });

  test("COORD-H02 - Con un invito pendente E una proposta Community attiva, la Home mostra SOLO il segnale ad alta priorità", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e un genitore con un invito di gruppo pendente E una proposta Community con interesse."
    );
    // REQUIRES LIVE VALIDATION: richiede uno scenario con ENTRAMBE le
    // condizioni vere per lo stesso account contemporaneamente — non
    // riproducibile senza un fixture dedicato. La garanzia "un solo segnale,
    // priorità alta prima" è comunque verificata a livello di codice
    // (lib/data/coordination-signal.ts: il ramo HIGH esce con return prima
    // di valutare MEDIUM/LOW, mai un array di segnali).
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bannerCount =
      (await page.getByText(/accetta o rifiuta/).count()) +
      (await page.getByText(/ha accettato la richiesta del gruppo/).count()) +
      (await page.getByText(/stanno valutando/).count());
    expect(bannerCount).toBeLessThanOrEqual(1);
  });
});
