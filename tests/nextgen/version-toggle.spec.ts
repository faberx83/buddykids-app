import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Versione LEGACY/NEXTGEN - Toggle
// Richiesta di Fabrizio: un modo per passare da LEGACY a NEXTGEN "coerente su
// tutta l'app", più semplice da gestire rispetto ad avere solo pagine/app
// diverse. Convive con le due PWA installabili separatamente (vedi
// tests/manual/multi-tenant-pwa.spec.ts TC-098/TC-099): quelle restano per chi
// vuole due icone sul telefono, questo toggle è la scorciatoia dentro l'app.

test.describe("Versione LEGACY/NEXTGEN - Toggle", () => {
  // 20/10/2026 — Fabrizio: "ovunque disabilita il pulsante NEXTGEN e forza
  // l'apertura dell'ultima versione". Prima TC-N28 verificava che "Passa a
  // NextGen" su "/" portasse a /nextgen; ora il pulsante non c'è da nessuna
  // parte e "/" porta comunque a /nextgen.
  test("TC-N28 - Il pulsante 'Passa a NextGen' non c'è più da nessuna parte e '/' porta a /nextgen", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    for (const path of ["/?v1=1", "/privacy", "/terms", "/nextgen"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /Passa a NextGen|Torna a V1/ })).toHaveCount(0);
    }
    await page.goto("/");
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  // Richiesta di Fabrizio (14/10/2026): "Torna a V1" tolto da NEXTGEN.
  // Prima TC-N29 verificava il ritorno a LEGACY da /nextgen.
  test("TC-N29 - Su /nextgen non c'è più 'Torna a V1' e non si viene rimandati a LEGACY", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByRole("button", { name: /Passa a NextGen|Torna a V1/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  test("TC-N30 - Il toggle non appare nei portali Gestore/Admin (LEGACY e NEXTGEN)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e account gestore/admin di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");
    await expect(page.getByRole("button", { name: /Passa a NextGen|Torna a V1/ })).toHaveCount(0);
  });

  // Visual Acceptance Gate (§15, TRAMA_ONE_VISUAL_ACCEPTANCE.md riga 1) —
  // bug reale trovato da Fabrizio con screenshot: il toggle si sovrapponeva
  // al titolo "TRAMA ONE — Parent" su "/one" (non era ancora in
  // HIDDEN_PREFIXES). "/one" ha già la propria freccia indietro verso
  // "/nextgen" nell'header: il toggle flottante è ridondante lì.
  test("TC-N614 - Il toggle non appare sulla shell TRAMA ONE Parent ('/one')", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/one");
    await expect(page.getByRole("button", { name: /Passa a NextGen|Torna a V1/ })).toHaveCount(0);
  });

  // ESCLUSO dall'automazione: simulare "display-mode: standalone" (icona
  // installata sulla home) non è supportato da Playwright emulateMedia.
  // Verifica manuale: aprire l'icona installata "BuddyKids" deve aprire
  // sempre LEGACY, "BuddyKids NextGen" deve aprire sempre NEXTGEN, anche se
  // l'ultima preferenza scelta nel browser normale era l'altra.
  test.fixme("TC-N31 - Aprire un'icona installata ignora sempre la preferenza del toggle", async () => {});
});
