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

  // BUGFIX (segnalato da Fabrizio: "quando viene presentato il logo, lo
  // sfondo è ancora sbagliato — azzurro invece che bianco") — non era la
  // pagina (già bg-white, TC-208), ma lo sfondo dipinto dal browser DIETRO
  // al logo prima che la pagina faccia il render: <meta name="theme-color">
  // (app/layout.tsx#generateViewport) e manifest-family.json#background_
  // color/theme_color usavano entrambi l'azzurro di brand (#4DAFEF). Ora
  // separati in `chromeColor` (bianco) vs `themeColor` (resta azzurro per
  // pulsanti/accenti) — vedi lib/tenant.ts.
  test("TC-210 - Il meta theme-color e il manifest (tenant famiglia) sono bianchi, non azzurri", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    const themeColorMeta = page.locator('meta[name="theme-color"]');
    await expect(themeColorMeta).toHaveAttribute("content", /^#fff(fff)?$/i);

    const manifest = await page.request.get("/manifest-family.json").then((r) => r.json());
    expect(manifest.background_color.toLowerCase()).toBe("#ffffff");
    expect(manifest.theme_color.toLowerCase()).toBe("#ffffff");
  });

  // BUGFIX (segnalato da Fabrizio con screenshot: "nelle schede del browser
  // sono tutte uguali (genitori, partner, admin)") — la favicon della scheda
  // browser era sempre la stessa a prescindere dal tenant. Causa: la
  // convenzione speciale di Next.js `app/favicon.ico` (file statico, NON
  // sensibile all'host) viene iniettata SEMPRE come primo <link rel="icon">,
  // prima delle icone per-tenant generate dinamicamente da
  // generateMetadata() (app/layout.tsx) — il browser preferisce quel primo
  // link generico per la scheda. Fix: rimosso app/favicon.ico, così restano
  // solo i <link> per-tenant (icon-192.png per famiglia, icon-partner-192.png
  // per partner, icon-admin-192.png per admin — vedi lib/tenant.ts).
  // NOTA: i fixture Playwright di questo progetto girano su un solo baseURL
  // (tenant famiglia, vedi tests/fixtures/roles.ts) — la verifica per
  // partner.*/admin.* va fatta a livello di codice (già fatto, stesso
  // generateMetadata() per tutti e 3 i tenant) e manualmente dopo il deploy.
  test("TC-261 - Nessun <link> favicon.ico generico; presente l'icona per-tenant corretta", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (tenant famiglia).");
    await page.goto("/auth/login");

    const genericFavicon = page.locator('link[rel="icon"][href*="favicon.ico"]');
    await expect(genericFavicon).toHaveCount(0);

    const tenantIcon = page.locator('link[rel="icon"][href*="icon-192.png"]');
    await expect(tenantIcon.first()).toHaveCount(1);
  });
});
