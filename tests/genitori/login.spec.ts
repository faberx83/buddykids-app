import { test, expect } from "../fixtures/roles";
import { isRealDeployment } from "../fixtures/roles";

// Area: TRAMA - Login (REBRAND Sprint 2, rivisto 2 volte)
// Header animato di /auth/login (solo tenant "family", vedi
// components/TramaLoginHeader.tsx + app/auth/login/LoginForm.tsx): fili ->
// wordmark -> tagline, SEMPRE sopra il form reale (email/password), sulla
// STESSA schermata — non più uno step "intro" separato con CTA proprie
// (corretto su richiesta di Fabrizio, con screenshot: i campi di accesso
// devono comparire sotto il logo animato, non su una pagina successiva).
// L'animazione riparte ad OGNI visita di /auth/login (non più "una tantum"
// per sessione, deciso da Fabrizio dopo aver provato la prima versione:
// "vorrei l'animazione sempre all'inizio, poi la comparsa dei campi") —
// vedi LoginForm.tsx#animateHeader, ora un valore derivato da `tenant`, non
// più stato/sessionStorage.

test.describe("TRAMA - Login (header animato)", () => {
  test("TC-204 - L'header animato e i campi email/password compaiono sulla stessa schermata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    await expect(page.getByRole("img", { name: "TRAMA" })).toBeVisible();
    await expect(page.getByText("Organizing childhood. Together.")).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();
  });

  test("TC-205 - L'animazione di ingresso riparte a ogni visita di /auth/login, non solo la prima", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");
    const mark = page.locator("img[alt='']").first(); // trama-logo-mark.png, decorativo (alt vuoto)
    await expect(mark).toHaveClass(/trama-mark-in/);

    await page.goto("/auth/login"); // stessa sessione browser: deve animarsi di nuovo
    await expect(mark).toHaveClass(/trama-mark-in/);
    // Il form resta comunque subito interagibile, animato o no.
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("TC-206 - Passando a 'Registrati' l'header animato resta sopra i campi, sulla stessa schermata", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    await page.getByRole("button", { name: "Non hai un account? Registrati" }).click();
    await expect(page.getByRole("img", { name: "TRAMA" })).toBeVisible();
    await expect(page.getByText("Codice invito (opzionale)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrati" })).toBeVisible();
  });

  test("TC-207 - Un link con ?invite= mostra subito il form di registrazione, con l'header sopra", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login?invite=ZZZZZZ");

    await expect(page.getByRole("img", { name: "TRAMA" })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrati" })).toBeVisible();
  });
});
