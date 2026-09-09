import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";

// TRAMA — Push notifications (31/08/2026). A differenza del notification
// center in-app (Wave 3/Partner), qui NON esiste quasi nulla di puro/
// testabile senza browser: la logica reale vive in lib/push/client.ts
// (window.atob, navigator.serviceWorker, PushManager — tutte API SOLO
// disponibili in un vero browser) e in lib/push/send.ts (server-only,
// richiede una sessione DB reale). L'UNICA cosa genuinamente verificabile
// senza un deploy live è il contenuto STATICO del service worker (un file
// sul disco, non un comportamento a runtime) — vedi PUSH-P00 sotto.
//
// Tutto il resto (permesso browser, subscribe/unsubscribe reali, ricezione
// effettiva di una push) richiede un deploy con VAPID configurate + un
// account reale: REQUIRES LIVE VALIDATION, non un blocker per costruzione
// (stesso principio già seguito per l'intera suite Playwright UI-driven di
// questo repository).

test.describe("Push notifications: service worker (no browser)", () => {
  test("PUSH-P00 [no browser] - public/sw.js espone i listener push e notificationclick", () => {
    const swPath = path.join(__dirname, "../../public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain('addEventListener("push"');
    expect(content).toContain('addEventListener("notificationclick"');
    // Il payload arriva come JSON (title/body/deepLink, vedi lib/push/send.ts
    // PushPayload) — un parse fallito non deve far crashare il listener.
    expect(content).toContain("event.data.json()");
  });

  // BUG TROVATO+CORRETTO (segnalazione Fabrizio 08/09/2026, "clicco la
  // notifica di check-in e non mi apre l'app installata ma la pagina web"):
  // app/api/cron/checkin-reminders/route.ts inviava deepLink: "/" (scope
  // Legacy), mentre public/manifest-nextgen.json dichiara "scope":
  // "/nextgen" — un URL fuori da quello scope non viene riconosciuto da
  // Android/Chrome come "dentro" la PWA NextGen installata al momento del
  // tap, quindi self.clients.openWindow() (sw.js) apre una scheda browser
  // invece di rilanciare l'app in modalità standalone. Verifica statica
  // (no browser, stesso principio di PUSH-P00 sopra): il sorgente deve
  // contenere il deepLink corretto, non quello sbagliato.
  test("PUSH-P01 [no browser] - la push di check-in punta a /nextgen, non alla radice Legacy fuori scope", () => {
    const routePath = path.join(__dirname, "../../app/api/cron/checkin-reminders/route.ts");
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('deepLink: "/nextgen"');
    expect(content).not.toMatch(/deepLink:\s*"\/"\s*,/);
  });
});

test.describe("Push notifications: UI attiva/disattiva", () => {
  test("PUSH-01 - il toggle \"Notifiche push\" è presente in Preferenze (genitore)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account parent.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/preferenze");
    await expect(page.getByText("Notifiche push", { exact: true })).toBeVisible();
  });

  test("PUSH-02 - il toggle \"Notifiche push\" è presente in Preferenze (Partner) — stesso componente condiviso", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account center_admin.");
    await loginAs(page, "center_admin");
    await page.goto("/center/account/preferenze");
    await expect(page.getByText("Notifiche push", { exact: true })).toBeVisible();
  });

});

// Deliberatamente NON incluso: un test che simula "permesso negato -> il
// toggle torna indietro" (handleTogglePush in ProfilePreferencesSection.tsx)
// è risultato troppo fragile per essere affidabile in automatico (il
// comportamento del prompt di permesso browser in modalità headless varia
// per engine/versione, spesso concede o nega di default indipendentemente
// da context.clearPermissions()) — una verifica onesta di questo percorso
// richiede QA manuale con Fabrizio su un browser reale, non un test che
// finge di verificarlo senza farlo davvero.

// ────────────────────────────────────────────────────────────────
// Fuori scope per questa suite (documentato, non un gap nascosto):
// - Ricezione effettiva di una push di sistema (richiede un round-trip
//   reale col push service del browser — non simulabile in Playwright).
// - I 4 trigger P0 (invito gruppo, proposta prenotazione, nuova richiesta
//   gruppo, nuova prenotazione): verificabili solo end-to-end con due
//   account reali e VAPID configurate, QA manuale con Fabrizio.
// ────────────────────────────────────────────────────────────────
