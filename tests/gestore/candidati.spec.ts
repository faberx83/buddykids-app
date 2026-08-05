import { test, expect } from "@playwright/test";
import { isRealDeployment } from "../fixtures/roles";

// Migrazione 21 — "Candidati come centro" (Fabrizio: "il registrati deve
// essere un 'candidati' per cui deve far partire processo di onboarding").
// /auth/candidati e /auth/candidati/conferma/[id] sono pagine PUBBLICHE
// (escluse dal role-gate di proxy.ts come tutto /auth/*, vedi
// app/auth/candidati/page.tsx), raggiungibili sullo STESSO baseURL di
// famiglia usato da questa suite — a differenza del branding "Candidati"
// dentro LoginForm.tsx (tenant==="partner"), che NON è testabile qui: la
// suite gira su un solo host (tests/fixtures/roles.ts, isRealDeployment) e
// non ha modo di simulare un hostname partner.* (stessa limitazione già
// documentata su TC-209 in tests/genitori/login.spec.ts).

test.describe("Candidati come centro (form pubblico, senza login)", () => {
  test("TC-512 - Il form Candidati invia la candidatura e mostra la pagina di conferma", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase (service role key) configurato.");
    const unique = Date.now();

    await page.goto("/auth/candidati");
    await page.getByLabel("Nome del centro").fill(`[TEST] Centro Autocandidatura ${unique}`);
    await page.getByLabel("Città / zona").fill("Milano");
    await page.getByLabel("Email di contatto").fill(`faberx83+candidato${unique}@gmail.com`);
    await page.getByRole("button", { name: "Invia candidatura" }).click();

    await page.waitForURL(/\/auth\/candidati\/conferma\//);
    await expect(page.getByText(`[TEST] Centro Autocandidatura ${unique}`)).toBeVisible();
    await expect(page.getByText("In revisione")).toBeVisible();
  });

  test("TC-513 - Un id di conferma inesistente mostra 'candidatura non trovata' con CTA per ricandidarsi", async ({
    page,
  }) => {
    await page.goto("/auth/candidati/conferma/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Candidatura non trovata" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Candidati come centro" })).toBeVisible();
  });

  test("TC-514 - Il form Candidati richiede nome centro ed email prima dell'invio", async ({ page }) => {
    await page.goto("/auth/candidati");
    await page.getByRole("button", { name: "Invia candidatura" }).click();
    // Validazione HTML5 nativa (required): niente submit, si resta sulla
    // stessa pagina — nessuna richiesta server-side effettuata.
    await expect(page).toHaveURL(/\/auth\/candidati$/);
    await expect(page.getByLabel("Nome del centro")).toBeVisible();
  });
});
