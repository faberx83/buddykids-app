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

  // SPRINT CORRETTIVO (feedback Fabrizio): "voglio vedere l'icona, il claim
  // ma su base bianca" — prima lo sfondo era bg-trama-page (#FDFCFA, un
  // off-white caldo), non bianco puro. Vedi anche TC-209 (fixme) per
  // Partner/Admin: la suite Playwright gira su un solo baseURL (tenant
  // famiglia), non ha un modo per simulare gli host partner./admin.* — non
  // automatizzabile senza estendere i fixture di test.
  test("TC-208 - Lo sfondo della schermata di Login (tenant famiglia) e' bianco puro", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    const bgColor = await page.evaluate(() => {
      const el = document.querySelector("body > div, #__next > div, main, div");
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    // bg-white di Tailwind -> rgb(255, 255, 255)
    expect(bgColor).toBe("rgb(255, 255, 255)");
  });

  // ESCLUSO dall'automazione: verificare lo sfondo bianco su Login Partner e
  // la presenza del claim su Login Admin richiede due hostname diversi
  // (partner.*/admin.*) — i fixture Playwright di questo progetto girano
  // tutti su un solo baseURL (vedi tests/fixtures/roles.ts), nessun supporto
  // per host multipli. Verificato invece a livello di codice (LoginForm.tsx).
  test.fixme("TC-209 - Login Partner ha sfondo bianco, Login Admin mostra il claim su navy", async () => {});
});
