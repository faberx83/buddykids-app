// TRAMA — SCREENSHOT REALI DELLE PAGINE V2 (14/10/2026, richiesta Fabrizio:
// "screen reali dall'app e uno state of the art per audit finale").
//
// Lo lancia Fabrizio sul Mac (Claude non apre l'app in produzione):
//   node scripts/screenshots-v2.mjs
//   SCREEN_BASE_URL=https://tramapp.it node scripts/screenshots-v2.mjs   (altro indirizzo)
//
// Cosa fa:
//   1. apre una finestra di Chromium grande come un iPhone (390×844);
//   2. se serve, aspetta che tu faccia il login nella finestra (poi premi Invio
//      nel Terminale). Il login resta salvato in .screens-profile/ per i lanci
//      successivi (cartella esclusa da git);
//   3. visita le pagine V2 e salva, per ognuna, la parte visibile (_top) e la
//      pagina intera (_full) in logs/screens-AAAAMMGG-HHMM/.
//
// SOLA LETTURA: apre pagine, schede (Settimana/Stagione, Elenco/Mappa), il
// foglio del "+" e una prenotazione. Nessun salvataggio, nessun modulo
// inviato, nessun dato modificato.
//
// Attenzione: le immagini contengono i dati veri del tuo account (nomi dei
// figli, prenotazioni). Guardale prima di condividerle.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const BASE = (process.env.SCREEN_BASE_URL || "https://buddykids-app.vercel.app").replace(/\/$/, "");
const d = new Date();
const two = (x) => String(x).padStart(2, "0");
const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
const OUT = path.join("logs", `screens-${stamp}`);
fs.mkdirSync(OUT, { recursive: true });

function waitEnter(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => (rl.close(), resolve())));
}

const context = await chromium.launchPersistentContext(".screens-profile", {
  headless: process.env.SCREEN_HEADLESS === "1",
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
});
const page = context.pages()[0] ?? (await context.newPage());

async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500); // font, icone, tasselli della mappa
}

// L'app è una "cornice da telefono": scorre il riquadro interno, non la
// pagina. Per la foto intera si sblocca la cornice solo durante lo scatto.
const UNLOCK = `
  html, body { height: auto !important; overflow: visible !important; }
  .app-shell { position: relative !important; inset: auto !important; height: auto !important; max-height: none !important; overflow: visible !important; }
  .app-shell * { max-height: none !important; }
  .app-shell .overflow-y-auto { overflow: visible !important; flex: none !important; height: auto !important; }
`;

const index = [];
let n = 0;
async function shoot(name, title) {
  n += 1;
  const base = `${String(n).padStart(2, "0")}-${name}`;
  await page.screenshot({ path: path.join(OUT, `${base}_top.png`) });
  const style = await page.addStyleTag({ content: UNLOCK });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${base}_full.png`), fullPage: true });
  await style.evaluate((el) => el.remove());
  index.push(`| ${base} | ${title} | ${page.url().replace(BASE, "")} |`);
  console.log(`✅ ${base} — ${title}`);
}

async function visit(url, name, title) {
  try {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
    await settle();
    await shoot(name, title);
  } catch (e) {
    console.log(`⚠️  ${name}: non riuscito (${e.message.split("\n")[0]})`);
  }
}

// 1) Login, se serve.
await page.goto(BASE + "/nextgen", { waitUntil: "domcontentloaded" });
await settle();
if (/\/auth\/|login/.test(page.url())) {
  await waitEnter("🔐 Fai il login nella finestra di Chromium, apri la Home e poi premi Invio qui… ");
  await page.goto(BASE + "/nextgen", { waitUntil: "domcontentloaded" });
  await settle();
}

// 2) Pagine.
await shoot("home", "Home V2");

try {
  await page.getByRole("button", { name: "Aggiungi" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-piu_top.png`) });
  index.push(`| ${String(n).padStart(2, "0")}-piu | Barra: foglio del + (Cosa aggiungi?) | /nextgen |`);
  console.log(`✅ ${String(n).padStart(2, "0")}-piu — foglio del +`);
  await page.keyboard.press("Escape");
} catch {
  console.log("⚠️  foglio del +: pulsante non trovato (nuova barra spenta?)");
}

await visit("/nextgen/planner?view=settimana", "planner-settimana", "Planner V2 — Settimana");
await visit("/nextgen/planner?view=stagione", "planner-stagione", "Planner V2 — Stagione");
await visit("/nextgen/planner?panel=mappa", "planner-mappa", "Planner V2 — Mappa");
await visit("/nextgen/planner?panel=gruppi", "planner-gruppi", "Planner V2 — Gruppi");
await visit("/nextgen/search", "scopri", "Scopri V2 — Elenco");
try {
  await page.getByRole("tab", { name: "Mappa" }).first().click();
  await settle();
  await shoot("scopri-mappa", "Scopri V2 — Mappa");
} catch {
  console.log("⚠️  Scopri Mappa: scheda non trovata");
}
await visit("/nextgen/prenotazioni", "prenotazioni", "Prenotazioni V2 — In arrivo");
try {
  await page.locator("main button, button").filter({ hasText: "€" }).first().click({ timeout: 5000 });
  await settle();
  await shoot("prenotazione-aperta", "Prenotazioni V2 — prenotazione aperta");
} catch {
  console.log("⚠️  prenotazione aperta: nessuna prenotazione da aprire");
}
await visit("/nextgen/profile", "profilo", "Profilo V2");
await visit("/nextgen/groups", "gruppi", "Gruppi V2 — elenco");
try {
  const href = await page.locator('a[href*="/nextgen/groups/"]').first().getAttribute("href", { timeout: 5000 });
  if (href) await visit(href, "gruppo", "Gruppi V2 — dettaglio");
} catch {
  console.log("⚠️  dettaglio gruppo: nessun gruppo da aprire");
}
await visit("/nextgen/trama", "trama", "Cos'è TRAMA");
await visit("/nextgen/profile/impostazioni", "impostazioni", "Sottopagina con intestazione condivisa (segno TRAMA)");
await visit("/admin/feature-flags", "admin-release", "Admin → Feature Flags → Release (tabella)");

fs.writeFileSync(
  path.join(OUT, "INDICE.md"),
  `# Screenshot TRAMA V2 — ${stamp}\n\nBase: ${BASE} · viewport 390×844 (iPhone)\n\n| File | Pagina | Indirizzo |\n|---|---|---|\n${index.join("\n")}\n`
);
console.log(`\n📁 Fatto: ${OUT}\n   Per ogni pagina: _top = schermo del telefono, _full = pagina intera.`);
await context.close();
