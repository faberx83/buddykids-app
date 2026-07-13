import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Versione LEGACY/NEXTGEN - Toggle
// Richiesta di Fabrizio: un modo per passare da LEGACY a NEXTGEN "coerente su
// tutta l'app", più semplice da gestire rispetto ad avere solo pagine/app
// diverse. Convive con le due PWA installabili separatamente (vedi
// tests/manual/multi-tenant-pwa.spec.ts TC-098/TC-099): quelle restano per chi
// vuole due icone sul telefono, questo toggle è la scorciatoia dentro l'app.

test.describe("Versione LEGACY/NEXTGEN - Toggle", () => {
  test("TC-N28 - Il toggle su '/' porta a NEXTGEN e ricorda la scelta", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Passa a NextGen" })).toBeVisible();
    await page.getByRole("button", { name: "Passa a NextGen" }).click();
    await expect(page).toHaveURL(/\/nextgen$/);

    // La preferenza resta salvata: tornando su "/" si viene rimandati a /nextgen.
    await page.goto("/");
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  test("TC-N29 - Il toggle su /nextgen porta a LEGACY e ricorda la scelta", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    await expect(page.getByRole("button", { name: "Torna a V1" })).toBeVisible();
    await page.getByRole("button", { name: "Torna a V1" }).click();
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

    await page.goto("/nextgen");
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  });

  test("TC-N30 - Il toggle non appare nei portali Gestore/Admin (LEGACY e NEXTGEN)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e account gestore/admin di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");
    await expect(page.getByRole("button", { name: /Passa a NextGen|Torna a V1/ })).toHaveCount(0);
  });

  // ESCLUSO dall'automazione: simulare "display-mode: standalone" (icona
  // installata sulla home) non è supportato da Playwright emulateMedia.
  // Verifica manuale: aprire l'icona installata "BuddyKids" deve aprire
  // sempre LEGACY, "BuddyKids NextGen" deve aprire sempre NEXTGEN, anche se
  // l'ultima preferenza scelta nel browser normale era l'altra.
  test.fixme("TC-N31 - Aprire un'icona installata ignora sempre la preferenza del toggle", async () => {});
});
