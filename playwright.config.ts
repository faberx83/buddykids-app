import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright per BuddyKids.
 *
 * Due modalita' di esecuzione, scelte tramite la variabile TEST_BASE_URL:
 *  - locale/mock (default): avvia `npm run dev` senza chiavi Supabase -> l'app
 *    gira sui dati demo (lib/mock-data.ts) e il "Ruolo demo" (RoleSwitcher) e'
 *    visibile, quindi i test possono cambiare ruolo senza login reale.
 *  - deploy reale: passa TEST_BASE_URL=https://buddykids-app.vercel.app (o
 *    l'alias giusto) + credenziali di test via env (vedi tests/fixtures/roles.ts).
 *    In questo caso il RoleSwitcher e' assente (Supabase configurato) e i test
 *    del gruppo "setup" fanno un login reale.
 */
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";

// Integration Stabilization Sprint (Gate B, luglio 2026) — root cause
// principale del cluster di 14+ fallimenti "page.waitForURL: Test timeout of
// 30000ms exceeded at loginAs" e di parte dei "did not run": SOLO 3 account
// fissi (parent/center_admin/platform_admin, vedi tests/fixtures/roles.ts)
// condivisi da ~880 test, ognuno dei quali fa un login UI reale via
// /auth/login. Con fullyParallel + workers di default (risolto a 4 in
// locale), decine di login concorrenti sugli STESSI 3 account colpiscono
// Supabase Auth in parallelo — latenza/contesa, non un bug applicativo (vedi
// AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md).
// Fix minimo e riproducibile, senza riscrivere ~80 file di test per usare
// storageState pre-autenticato: contro un deploy reale (TEST_BASE_URL
// impostato) riduciamo il parallelismo (meno login concorrenti sugli stessi
// account) e aggiungiamo un retry (i fallimenti da latenza transitoria
// passano al secondo tentativo; un bug applicativo persistente resta
// "failed" anche dopo retry — non nasconde nulla, il JSON report riporta
// comunque i "retries" per il triage).
const isRealDeployment = Boolean(baseURL && !/localhost|127\.0\.0\.1/.test(baseURL));

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: isRealDeployment ? 2 : undefined,
  retries: process.env.CI || isRealDeployment ? 1 : 0,
  // Reporter da terminale: "line" invece di "list" — una singola riga che si
  // aggiorna con l'avanzamento (N/Totale) invece di una riga per ogni
  // singolo test, molto più leggibile durante un deploy. I fallimenti
  // restano comunque stampati per intero quando accadono. Report HTML
  // completo, trace e screenshot sui fallimenti restano invariati (vedi
  // "use" sotto) — nessuna perdita di diagnostica, solo output terminale
  // meno verboso.
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["line"],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  // Se non punti a un deploy remoto, fa partire da solo `npm run dev`.
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
