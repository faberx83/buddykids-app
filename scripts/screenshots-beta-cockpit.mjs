// TRAMA — SCREENSHOT DEL BETA COCKPIT (20/10/2026). Stesso schema di
// scripts/screenshots-v2.mjs, ma per l'Admin e a misura di computer.
//
// Lo lancia Fabrizio sul Mac (Claude non apre l'app in produzione):
//   node scripts/screenshots-beta-cockpit.mjs
//   SCREEN_BASE_URL=https://admin.tramapp.it node scripts/screenshots-beta-cockpit.mjs
//
// Apre Chromium (1440×900). Se serve, fai il login Admin nella finestra e
// premi Invio nel Terminale (il login resta in .screens-profile-admin/,
// esclusa da git). Poi visita Overview, Famiglie, Funnel, Utilizzo,
// Frizioni, Centri, Feedback, il dettaglio di una famiglia e il Report, e
// salva _top (schermo) e _full (pagina intera) in logs/screens-beta-AAAAMMGG-HHMM/.
//
// SOLA LETTURA: apre pagine e link, non preme pulsanti e non invia moduli.
// Le immagini contengono dati reali della beta: guardale prima di condividerle.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const BASE = (process.env.SCREEN_BASE_URL || "https://admin.tramapp.it").replace(/\/$/, "");
const d = new Date();
const two = (x) => String(x).padStart(2, "0");
const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
const OUT = path.join("logs", `screens-beta-${stamp}`);
fs.mkdirSync(OUT, { recursive: true });

const context = await chromium.launchPersistentContext(".screens-profile-admin", {
  headless: process.env.SCREEN_HEADLESS === "1",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "it-IT",
  timezoneId: "Europe/Rome",
});
const page = context.pages()[0] ?? (await context.newPage());

async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const index = [];
let n = 0;
async function shoot(name, title) {
  n += 1;
  const base = `${String(n).padStart(2, "0")}-${name}`;
  await page.screenshot({ path: path.join(OUT, `${base}_top.png`) });
  await page.screenshot({ path: path.join(OUT, `${base}_full.png`), fullPage: true });
  index.push(`| ${base} | ${title} | ${page.url().replace(BASE, "")} |`);
  console.log(`✅ ${base} — ${title}`);
}

async function visit(url, name, title) {
  try {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
    await settle();
    await shoot(name, title);
  } catch (e) {
    console.log(`⚠️  ${title}: ${e.message}`);
  }
}

await page.goto(BASE + "/admin/beta", { waitUntil: "domcontentloaded" });
await settle();
if (!page.url().includes("/admin/beta") && !page.url().includes("/beta")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((r) => rl.question("👉 Fai il login Admin nella finestra, poi premi Invio qui… ", () => (rl.close(), r())));
}

await visit("/admin/beta", "overview", "Beta Famiglie — Overview e Richiede attenzione");
await visit("/admin/beta?tab=famiglie", "famiglie", "Tabella famiglie");
await visit("/admin/beta?tab=funnel", "funnel", "Funnel e tempo al valore");
await visit("/admin/beta?tab=utilizzo", "utilizzo", "Utilizzo per area");
await visit("/admin/beta?tab=frizioni", "frizioni", "Frizioni");
await visit("/admin/beta?tab=centri", "centri", "Domanda verso i centri");
await visit("/admin/beta?tab=feedback", "feedback", "Feedback e survey");
try {
  await page.goto(BASE + "/admin/beta?tab=famiglie", { waitUntil: "domcontentloaded" });
  await settle();
  const href = await page.locator('a[href*="/admin/beta/famiglia/"]').first().getAttribute("href", { timeout: 5000 });
  if (href) await visit(href, "famiglia", "Dettaglio famiglia e timeline");
} catch {
  console.log("⚠️  dettaglio famiglia: nessuna famiglia da aprire");
}
await visit("/admin/beta/report", "report", "Beta → Report (ultima finestra chiusa)");

fs.writeFileSync(
  path.join(OUT, "INDICE.md"),
  `# Screenshot Beta Cockpit — ${stamp}\n\nBase: ${BASE} · 1440×900\n\n| File | Pagina | Indirizzo |\n|---|---|---|\n${index.join("\n")}\n`
);
console.log(`\n📁 Fatto: ${OUT}`);
await context.close();
