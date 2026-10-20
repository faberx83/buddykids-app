// TRAMA — feedback 20/10/2026 (Fabrizio: "nel loader valuterei logo più
// grande o wordmark sotto"; "ogni volta che apro l'app rimane nell'ultima
// pagina… dopo un tot ritornare sempre sulla Home"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { RETURN_HOME_AFTER_MS, parseLastSeen, shouldReturnHome } from "../../lib/nextgen/return-home";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const now = 1_800_000_000_000;
const long = now - RETURN_HOME_AFTER_MS - 1;

test.describe("TRAMA — Loader e ritorno alla Home [no browser]", () => {
  test("RH-01 dopo più di 30 minuti sulla stessa pagina → Home", () => {
    const last = { at: long, path: "/nextgen/planner?week=2026-10-19" };
    expect(shouldReturnHome({ now, last, currentPath: "/nextgen/planner?week=2026-10-19", fromNotification: false })).toBe(true);
  });

  test("RH-02 si resta dove si è: pausa breve, già in Home, notifica, link verso un'altra pagina, fuori dall'app famiglie", () => {
    const path1 = "/nextgen/planner";
    expect(shouldReturnHome({ now, last: { at: now - 60_000, path: path1 }, currentPath: path1, fromNotification: false })).toBe(false);
    expect(shouldReturnHome({ now, last: { at: long, path: "/nextgen" }, currentPath: "/nextgen", fromNotification: false })).toBe(false);
    expect(shouldReturnHome({ now, last: { at: long, path: path1 }, currentPath: path1, fromNotification: true })).toBe(false);
    expect(shouldReturnHome({ now, last: { at: long, path: path1 }, currentPath: "/nextgen/prenotazioni", fromNotification: false })).toBe(false);
    expect(shouldReturnHome({ now, last: { at: long, path: "/booking/x" }, currentPath: "/booking/x", fromNotification: false })).toBe(false);
    expect(shouldReturnHome({ now, last: null, currentPath: path1, fromNotification: false })).toBe(false);
    expect(parseLastSeen("{rotto")).toBeNull();
    expect(parseLastSeen(JSON.stringify({ at: 1, path: "/nextgen/x" }))).toEqual({ at: 1, path: "/nextgen/x" });
  });

  test("RH-03 solo app installata; le notifiche si fanno riconoscere (messaggio o ?da=notifica)", () => {
    const c = read("components/nextgen/ReturnHomeAfterIdle.tsx");
    expect(c).toContain('if (typeof window === "undefined" || !isStandalone()) return;');
    expect(c).toContain('document.addEventListener("visibilitychange", onVisibility);');
    expect(c).toContain('"trama-opened-from-notification"');
    const sw = read("public/sw.js");
    expect(sw).toContain('client.postMessage({ type: "trama-opened-from-notification" });');
    expect(sw).toContain('const markedUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "da=notifica";');
    expect(sw).toContain("return self.clients.openWindow(markedUrl);");
  });

  test("RH-04 dalla card Release, spento di default, montato una volta nel layout", () => {
    expect(FEATURE_FLAG_REGISTRY.RETURN_HOME_AFTER_IDLE_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_CATALOG.find((e) => e.key === "return_home_after_idle")?.releaseEligible).toBe(true);
    expect(getReleaseById("home-dopo-pausa")?.featureKeys).toEqual(["return_home_after_idle"]);
    expect(read("app/nextgen/layout.tsx")).toContain("{returnHomeEnabled && <ReturnHomeAfterIdle />}");
  });

  // 20/10/2026 (quarto giro, "verifica che il beige sia lo stesso del resto
  // del sito… userei il b"): sfondo delle pagine (trama-page), logo 220,
  // scritta 0.8, filo colorato sotto; lo stesso disegno anche nello splash.
  test("LD-02 loader: logo più grande nell'app e scritta TRAMA sotto", () => {
    const s = read("components/TramaSpinner.tsx");
    expect(s).toContain("wordmark = true,");
    expect(s).toContain("size = 220,");
    expect(s).toContain("thread = true,");
    expect(s).toContain("const width = Math.round(size * 0.8);");
    expect(s).not.toContain("trama-loader-glow");
    expect(s).toContain('export const LOADER_SCREEN = "fixed inset-0 z-[80] flex items-center justify-center bg-trama-page";');
    for (const p of ["app/nextgen/loading.tsx", "app/(main)/loading.tsx", "app/center/loading.tsx"]) {
      expect(read(p), p).toContain("<div className={LOADER_SCREEN}>");
    }
    expect(read("app/admin/loading.tsx")).toContain("<div className={LOADER_SCREEN_ADMIN}>");
    expect(read("app/nextgen/loading.tsx")).toContain("<TramaSpinner size={220} />");
    // Lo splash d'apertura usa lo stesso disegno, sullo stesso sfondo.
    expect(read("components/AppSplashOverlay.tsx")).toContain("<TramaSpinner size={200} tone={splashTone(logoSrc)} still label=\"TRAMA\" />");
    expect(read("app/layout.tsx")).toContain('config.chromeColor.toUpperCase() === "#FFFFFF" ? "#FDFCFA" : config.chromeColor');
    const css = read("app/globals.css");
    expect(css).not.toContain("tramaGlow");
    expect(css).toContain("@keyframes tramaThread");
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.trama-loader-word,\s*\.trama-loader-thread > span \{\s*animation: none;/);
  });
});

// 20/10/2026 — Fabrizio: "ovunque disabilita il pulsante NEXTGEN e forza
// l'apertura dell'ultima versione (l'ho notato nei termini di servizio e
// nell'informativa privacy)". [no browser]
test.describe("TRAMA — versione nuova ovunque [no browser]", () => {
  const read2 = (p: string) => require("fs").readFileSync(require("path").join(__dirname, "../..", p), "utf-8") as string;
  test("NV-01 il pulsante 'Passa a NextGen' non si disegna più su nessuna pagina", () => {
    const s = read2("components/VersionToggle.tsx");
    expect(s).toMatch(/export default function VersionToggle\(\) \{\s*return null;\s*\}/);
  });
  test("NV-02 chi è collegato legge Termini e Privacy dentro l'app nuova", () => {
    const p = read2("proxy.ts");
    expect(p).toContain('"/privacy": "/nextgen/informative/privacy",');
    expect(p).toContain('"/terms": "/nextgen/informative/termini",');
    expect(p).toContain("if (isSupabaseConfigured && inAppLegal && (await getRequestUserId(request))) {");
  });
});
