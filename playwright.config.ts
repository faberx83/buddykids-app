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

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
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
