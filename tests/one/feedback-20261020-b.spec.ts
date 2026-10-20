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

  test("LD-02 loader: logo più grande nell'app e scritta TRAMA sotto", () => {
    const s = read("components/TramaSpinner.tsx");
    expect(s).toContain("wordmark = true,");
    expect(s).toContain("style={{ width: Math.round(size * 0.55), height: \"auto\" }}");
    expect(read("app/nextgen/loading.tsx")).toContain("<TramaSpinner size={128} />");
  });
});
