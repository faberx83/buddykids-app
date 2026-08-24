import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { areaLabelFromPath } from "../../lib/nextgen/beta-feedback-areas";

// TRAMA ONE — Prenotazioni NEXTGEN-native (24/08/2026): chiude il gap
// segnalato da Fabrizio ("le prenotazioni vanno ancora sul vecchio schema").
// /nextgen/prenotazioni (nuovo) monta lo STESSO PrenotazioniClient di sempre
// (contenuto invariato, già TRAMA-current) ma sotto il guscio NEXTGEN
// (NextgenBottomNav) invece di quello LEGACY, con il logo TRAMA
// (showBrandIcon) nell'header — stesso pattern di ogni altra pagina NEXTGEN
// Genitore.
test.describe("TRAMA ONE — Prenotazioni NEXTGEN-native", () => {
  test("TC-N639 - /nextgen/prenotazioni mostra il guscio NEXTGEN (bottom nav con 'Prenotazioni' attiva) e il logo TRAMA nell'header, non lo shell LEGACY", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test."
    );

    await loginAs(page, "parent");
    await page.goto("/nextgen/prenotazioni");

    // Contenuto reale (PrenotazioniClient, invariato) — non una pagina vuota.
    await expect(page.getByText("Le mie prenotazioni")).toBeVisible();

    // Guscio NEXTGEN: NextgenBottomNav con la voce "Prenotazioni" evidenziata
    // come attiva (stesso pattern di isActive() in NextgenBottomNav.tsx).
    const navLink = page.locator('a[href="/nextgen/prenotazioni"]', { hasText: "Prenotazioni" });
    await expect(navLink).toBeVisible();
    await expect(navLink.locator("i")).toHaveClass(/text-trama-violet/);

    // Logo TRAMA accanto al titolo (PageHeader#showBrandIcon=true, passato
    // solo dal call site NEXTGEN) — stesso locator di TC-N89.
    await expect(page.locator('img[src="/brand/trama-logo-mark.png"][aria-hidden="true"]')).toBeVisible();
  });

  test("TC-N640 - il link 'Prenotazioni' dal Planner/Home/Profilo NEXTGEN porta a /nextgen/prenotazioni, non più a /prenotazioni (LEGACY)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account genitore di test."
    );

    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");
    await page.getByText("Le mie prenotazioni").first().click();
    await expect(page).toHaveURL(/\/nextgen\/prenotazioni/);
  });
});

// Verifica "no browser" dell'etichetta segnalazioni beta per la nuova rotta:
// gira sempre, anche in questo sandbox senza browser reale.
test.describe("TRAMA ONE — beta-feedback area label per Prenotazioni NEXTGEN [no browser]", () => {
  test("TC-N641 - areaLabelFromPath riconosce /nextgen/prenotazioni come 'Le mie prenotazioni'", () => {
    expect(areaLabelFromPath("/nextgen/prenotazioni")).toBe("Le mie prenotazioni");
    expect(areaLabelFromPath("/nextgen/prenotazioni?bookingId=abc")).toBe("Le mie prenotazioni");
  });
});
