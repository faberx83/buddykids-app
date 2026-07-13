import { test, expect } from "../fixtures/roles";
import { isRealDeployment } from "../fixtures/roles";

// Area: TRAMA - Login (REBRAND Sprint 2)
// Intro animata di /auth/login (solo tenant "family", vedi
// components/TramaLoginIntro.tsx + app/auth/login/LoginForm.tsx): sequenza
// fili -> wordmark -> tagline -> CTA "Accedi"/"Crea un account", riprodotta
// una sola volta per sessione (sessionStorage). Il bottone "Crea un account"
// (testo esatto) esiste SOLO nell'intro: il form reale, in modalita' signup,
// ha un submit "Registrati" e un link "Hai gia' un account? Accedi" — non e'
// mai ambiguo con l'intro, utile come segnale robusto in questi test.

test.describe("TRAMA - Login (intro animata)", () => {
  test("TC-204 - L'intro animata compare al primo accesso e mostra wordmark, tagline e le CTA", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    await expect(page.getByRole("img", { name: "TRAMA" })).toBeVisible();
    await expect(page.getByText("Organizing childhood. Together.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crea un account" })).toBeVisible();
    // Finche' l'intro e' a schermo il form reale non e' nel DOM (montaggio
    // mutuamente esclusivo, vedi LoginForm.tsx#showIntro) — niente campo email.
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
  });

  test("TC-205 - Toccare 'Accedi' nell'intro avanza subito al form di login reale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Crea un account" })).toHaveCount(0);
  });

  test("TC-206 - Toccare 'Crea un account' nell'intro avanza al form di registrazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    await page.getByRole("button", { name: "Crea un account" }).click();
    await expect(page.getByText("Codice invito (opzionale)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrati" })).toBeVisible();
  });

  test("TC-207 - L'intro non ricompare in una seconda visita di /auth/login nella stessa sessione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Crea un account" })).toBeVisible();

    await page.goto("/auth/login"); // stessa pagina, stesso browser context/sessionStorage
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Crea un account" })).toHaveCount(0);
  });

  test("TC-208 - Un link con ?invite= salta l'intro e mostra subito il form di registrazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login?invite=ZZZZZZ");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Crea un account" })).toHaveCount(0);
  });
});
