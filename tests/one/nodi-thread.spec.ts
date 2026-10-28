// TRAMA — NODI THREAD (28/10/2026). Integrazione degli asset definitivi del
// pacchetto TRAMA_NODI_THREAD_FINAL v1.0 dietro NODI_ENABLED. [no browser]

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { test, expect } from "@playwright/test";
import {
  NODI_COPY,
  NODI_FLAG,
  NODI_MAX_PX,
  NODI_SIZE,
  NODI_STATES,
  isPlannerWeekEmpty,
  nodiAfterAssign,
  nodiAsset,
} from "../../lib/nextgen/nodi";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";

const root = path.join(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf-8");

// Impronte degli SVG del pacchetto approvato: se cambiano, qualcuno ha
// ridisegnato o modificato un asset (vietato dal pacchetto).
const SVG_SHA256: Record<string, string> = JSON.parse(read("tests/one/fixtures/nodi-svg-sha256.json"));

test.describe("TRAMA — Nodi Thread [no browser]", () => {
  test("NODI-01 asset: 17 SVG del pacchetto in public/assets/nodi, identici all'originale", () => {
    const dir = path.join(root, "public/assets/nodi");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
    expect(files).toEqual(Object.keys(SVG_SHA256).sort());
    for (const f of files) {
      const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex");
      expect(sha, f).toBe(SVG_SHA256[f]);
    }
    // ogni stato ha la versione chiara e quella navy; il micro è uno solo
    for (const s of NODI_STATES) {
      expect(files).toContain(`nodi-${s}.svg`);
      expect(files).toContain(`nodi-${s}-navy.svg`);
    }
    expect(files).toContain("nodi-micro.svg");
  });

  test("NODI-02 misure: micro sotto 32, mai sopra 88, niente sotto 16, navy col suo file", () => {
    // Ritocco del 28/10 pomeriggio: gli stati con il volto vanno da 32 a 88 px (prima minimo 48).
    expect(nodiAsset("empty", 56)).toEqual({ src: "/assets/nodi/nodi-empty.svg", size: 56, micro: false });
    expect(nodiAsset("problem", 34, true)?.src).toBe("/assets/nodi/nodi-problem-navy.svg");
    expect(nodiAsset("connect", 32)).toEqual({ src: "/assets/nodi/nodi-connect.svg", size: 32, micro: false });
    expect(nodiAsset("welcome", 160)).toEqual({ src: "/assets/nodi/nodi-welcome.svg", size: 88, micro: false });
    expect(nodiAsset("success", 24)).toEqual({ src: "/assets/nodi/nodi-micro.svg", size: 24, micro: true });
    expect(nodiAsset("success", 31, true)?.src).toBe("/assets/nodi/nodi-micro.svg");
    expect(nodiAsset("idle", 15)).toBeNull();
    // ogni file restituito esiste davvero
    for (const s of NODI_STATES) {
      for (const navy of [false, true]) {
        for (const size of [20, 32, 48, 88]) {
          const a = nodiAsset(s, size, navy)!;
          expect(fs.existsSync(path.join(root, "public", a.src)), a.src).toBe(true);
        }
      }
    }
  });

  test("NODI-03 dopo Chi accompagna: settimana completa = successo, giorno completo = connessione, altrimenti niente", () => {
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 2 }, { dayMissing: 0, weekMissing: 0 })).toEqual({
      state: "success",
      text: NODI_COPY.weekDone,
    });
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 5 }, { dayMissing: 0, weekMissing: 3 })).toEqual({
      state: "connect",
      text: "Fatto. Ora lo sanno tutti.",
    });
    // una scelta parziale, nessun cambio, o una settimana già a posto: niente Nodi
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 5 }, { dayMissing: 1, weekMissing: 4 })).toBeNull();
    expect(nodiAfterAssign({ dayMissing: 0, weekMissing: 0 }, { dayMissing: 0, weekMissing: 0 })).toBeNull();
    expect(nodiAfterAssign({ dayMissing: 0, weekMissing: 3 }, { dayMissing: 0, weekMissing: 3 })).toBeNull();
    // foglio della settimana (nessun giorno): solo il successo
    expect(nodiAfterAssign({ dayMissing: null, weekMissing: 3 }, { dayMissing: null, weekMissing: 1 })).toBeNull();
    expect(nodiAfterAssign({ dayMissing: null, weekMissing: 3 }, { dayMissing: null, weekMissing: 0 })?.state).toBe("success");
  });

  test("NODI-04 Planner vuoto: niente impegni e niente chiusure", () => {
    const day = (closureLabels: string[] = []) => ({ closureLabels });
    expect(isPlannerWeekEmpty({ entryCount: 0, days: [day(), day()] })).toBe(true);
    expect(isPlannerWeekEmpty({ entryCount: 1, days: [day(), day()] })).toBe(false);
    expect(isPlannerWeekEmpty({ entryCount: 0, days: [day(["Ponte"]), day()] })).toBe(false);
  });

  test("NODI-05 testi del pacchetto, senza linguaggio da chatbot", () => {
    expect(NODI_COPY.emptyPlannerTitle).toBe("Qui prenderà forma la vostra settimana.");
    // Ritocco del 28/10: è il titolo della riga "Chi fa cosa" (stessa tipografia, una riga su telefono).
    expect(NODI_COPY.problemTitle).toBe("Piccolo nodo da sciogliere");
    expect(NODI_COPY.connect).toBe("Fatto. Ora lo sanno tutti.");
    expect(NODI_COPY.groupsEmptyTitle).toBe("Un filo da solo è solo un filo.");
    for (const t of Object.values(NODI_COPY)) {
      expect(t).not.toMatch(/sono Nodi|posso aiutarti|campione|!!|Ops/i);
    }
  });

  test("NODI-06 flag spento di default, voce di catalogo e release", () => {
    expect(NODI_FLAG).toBe("NODI_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.NODI_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((e) => e.key === "nodi_thread");
    expect(entry?.flagName).toBe("NODI_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(entry?.status).toBe("INTERNAL_PREVIEW");
    const release = getReleaseById("nodi-thread");
    expect(release?.featureKeys).toEqual(["nodi_thread"]);
    expect(release?.targetAudience).toEqual(["parent"]);
  });

  test("NODI-07 componente: <img> sugli asset, decorativo, solo il ripiego se il flag è spento, niente ricostruzioni", () => {
    const src = read("components/nextgen/Nodi.tsx");
    // flag spento: nessun Nodi, solo il ripiego (di default nulla) — garanzia di prima, estesa al ripiego
    expect(src).toMatch(/if \(!enabled\) return <>\{fallback\}<\/>;/);
    expect(src).toMatch(/fallback = null,/);
    expect(src).toMatch(/<img/);
    expect(src).toMatch(/aria-hidden=\{decorative \? true : undefined\}/);
    expect(src).toMatch(/alt=\{decorative \? "" :/);
    // nessuna ricostruzione della mascotte (né SVG inline né filtri CSS per il navy)
    expect(src).not.toMatch(/<svg|<path|filter:|invert\(/);
    expect(read("lib/nextgen/nodi.ts")).not.toMatch(/<svg|<path/);
  });

  test("NODI-08 layout: flag risolto in parallelo, solo famiglie e Admin piattaforma, provider sopra gli avvisi", () => {
    const src = read("app/nextgen/layout.tsx");
    expect(src).toMatch(/flagName: NODI_FLAG[\s\S]*?\.catch\(\(\) => false\)/);
    expect(src).toMatch(/nodiEnabled = nodiResolved && \(realRole === "parent" \|\| realRole === "platform_admin"\)/);
    expect(src.indexOf("<NodiProvider enabled={nodiEnabled}>")).toBeGreaterThan(-1);
    expect(src.indexOf("<NodiProvider enabled={nodiEnabled}>")).toBeLessThan(src.indexOf("<NextgenToastProvider>"));
  });

  test("NODI-09 posizionamenti: dentro elementi che esistono già, stati e misure del ritocco", () => {
    const onb = read("components/nextgen/OnboardingV2.tsx");
    expect(onb).toMatch(/kids\.length === 0 && <Nodi state="welcome" size=\{NODI_SIZE\.onboarding\} \/>/);
    expect(onb.match(/<Nodi /g)?.length).toBe(1);

    const card = read("components/nextgen/SeasonSummaryCard.tsx");
    expect(card).toMatch(/\{nodi && <Nodi state="focus" size=\{NODI_SIZE\.homeHint\}/);
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toMatch(/welcome=\{welcome\}[\s\S]{0,200}?\n\s+nodi\n/);

    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    // settimana vuota: nella riga "giornata libera" della vista un giorno alla volta
    expect(planner).toMatch(/emptyWeekNodi=\{nodiEnabled && isPlannerWeekEmpty\(week\)\}/);
    const day = read("components/nextgen/PlannerDayFocus.tsx");
    expect(day).toMatch(/busy\.length === 0 && emptyWeekNodi[\s\S]{0,400}?<Nodi state="empty" size=\{NODI_SIZE\.plannerEmpty\}/);
    expect(day).toMatch(/busy\.length === 0 && !emptyWeekNodi && \(/);
    expect(day).not.toMatch(/KidChainCard[\s\S]*<Nodi/); // mai nelle card dei figli
    // problema: al posto dell'icona da 34 px di "Chi fa cosa", con l'icona come ripiego
    expect(planner).toMatch(/nodiProblem \? <Nodi state="problem" size=\{NODI_SIZE\.problem\} yieldToToast fallback=\{icon\} \/> : icon/);
    expect(planner).toMatch(/\{nodiProblem \? NODI_COPY\.problemTitle : "Chi fa cosa"\}/);
    // fogli Chi fa cosa / Chi accompagna: fotografia all'apertura, confronto alla chiusura
    expect(planner).toMatch(/panel === "chi" \? "chi" : panel !== null && typeof panel === "object" && "assign" in panel \? `assign:\$\{panel\.assign\}` : null/);
    expect(planner).toMatch(/if \(moment\) showToast\(moment\.text, "success", \{ nodi: moment\.state \}\);/);
    expect(planner).toMatch(/\}, \[panelKey\]\);/);

    const groups = read("components/GroupsClient.tsx");
    expect(groups).toMatch(/v2 && nodiEnabled \?[\s\S]{0,200}?<Nodi state="group" size=\{NODI_SIZE\.groupsEmpty\}/);

    const discover = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(discover).toMatch(/v2 && nodiEnabled \?[\s\S]{0,800}?<Nodi state="focus" size=\{NODI_SIZE\.discoverEmpty\}/);

    const toast = read("components/nextgen/NextgenToastProvider.tsx");
    expect(toast).toMatch(/<Nodi state=\{t\.nodi\} size=\{NODI_SIZE\.toast\} navy \/>/);
    expect(toast).toMatch(/nodiEnabled \? \(options\?\.nodi \?\? null\) : null/);
  });

  test("NODI-11 presenza, non protagonista: misure piccole, nessuna card nuova, stessa struttura senza Nodi", () => {
    // misure "mobile" del ritocco (l'app vive in una cornice telefono)
    expect(NODI_SIZE.onboarding).toBeLessThanOrEqual(72);
    expect(NODI_SIZE.plannerEmpty).toBeGreaterThanOrEqual(56);
    expect(NODI_SIZE.plannerEmpty).toBeLessThanOrEqual(64);
    expect(NODI_SIZE.groupsEmpty).toBeLessThanOrEqual(72);
    expect(NODI_SIZE.homeHint).toBeLessThanOrEqual(48);
    expect(NODI_SIZE.problem).toBeGreaterThanOrEqual(32);
    expect(NODI_SIZE.problem).toBeLessThanOrEqual(48);
    expect(NODI_SIZE.discoverEmpty).toBeLessThanOrEqual(48);
    expect(NODI_SIZE.toast).toBeGreaterThanOrEqual(24);
    expect(NODI_SIZE.toast).toBeLessThanOrEqual(32);
    for (const v of Object.values(NODI_SIZE)) expect(v).toBeLessThanOrEqual(NODI_MAX_PX);
    expect(NODI_MAX_PX).toBe(88);
    // nessuna misura scritta a mano nei posizionamenti
    for (const f of [
      "components/nextgen/OnboardingV2.tsx",
      "components/nextgen/SeasonSummaryCard.tsx",
      "app/nextgen/planner/PlannerV2Client.tsx",
      "components/nextgen/PlannerDayFocus.tsx",
      "components/GroupsClient.tsx",
      "app/nextgen/search/SearchDiscoveryClient.tsx",
      "components/nextgen/NextgenToastProvider.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/<Nodi [^>]*size=\{\d+\}/);
    }
    // niente card nate per Nodi (la prima versione le aveva)
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).not.toContain("nodi-problem-card");
    expect(planner).not.toContain("nodi-planner-empty");
    // l'avviso resta la pillola di prima; con Nodi solo il fondo navy (variante navy dell'asset)
    const toast = read("components/nextgen/NextgenToastProvider.tsx");
    expect(toast).toContain("rounded-full");
    expect(toast).toContain('t.nodi ? "bg-trama-navy py-1 pl-1.5 pr-4" : "bg-ink px-4 py-2.5"');
    expect(toast).not.toMatch(/rounded-2xl border border-trama-line bg-white/);
    // senza Nodi (flag spento) il componente rende il ripiego: stessa struttura di prima
    const comp = read("components/nextgen/Nodi.tsx");
    expect(comp).toContain("if (!enabled) return <>{fallback}</>;");
  });

  test("NODI-10 mai nell'intestazione, nella barra, sulle card attività o al posto del logo", () => {
    for (const f of [
      "components/nextgen/NextgenBottomNav.tsx",
      "components/PageHeader.tsx",
      "components/nextgen/ProfileChip.tsx",
      "components/nextgen/DiscoverResultCard.tsx",
      "components/nextgen/AgendaItemRow.tsx",
      "components/nextgen/TramaThread.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/components\/nextgen\/Nodi"/);
    }
    // il logo dell'onboarding resta quello di TRAMA
    expect(read("components/nextgen/OnboardingV2.tsx")).toMatch(/src="\/brand\/trama-logo-mark\.png"/);
  });
});
