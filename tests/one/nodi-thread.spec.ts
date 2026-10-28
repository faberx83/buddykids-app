// TRAMA — NODI THREAD (28/10/2026). Asset del pacchetto approvato
// TRAMA_NODI_THREAD_REFERENCE_PACK_v2 (28/10 sera, al posto del v1.0) dietro
// NODI_ENABLED. [no browser]

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

// Impronte dei PNG e del manifest del pacchetto approvato (v2): se cambiano,
// qualcuno ha ridisegnato, ritagliato o ricolorato un asset (vietato).
const ASSET_SHA256: Record<string, string> = JSON.parse(read("tests/one/fixtures/nodi-assets-sha256.json"));
const manifest = JSON.parse(read("lib/nextgen/nodi-manifest.json"));

test.describe("TRAMA — Nodi Thread [no browser]", () => {
  test("NODI-01 asset: solo i 18 PNG del pacchetto v2 (1x e @2x), identici; manifest identico; niente asset v1", () => {
    const dir = path.join(root, "public/assets/nodi");
    const files = fs.readdirSync(dir).sort();
    expect(files).toEqual(Object.keys(ASSET_SHA256).filter((k) => k !== "__manifest__").sort());
    for (const f of files) {
      const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex");
      expect(sha, f).toBe(ASSET_SHA256[f]);
    }
    const msha = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "lib/nextgen/nodi-manifest.json"))).digest("hex");
    expect(msha).toBe(ASSET_SHA256.__manifest__);
    // nessun asset della versione precedente (svg, -navy, micro) e nessuna ricostruzione vettoriale
    expect(files.some((f) => /\.svg$|-navy|micro/.test(f))).toBe(false);
    // ogni asset del manifest ha il suo PNG 1x e @2x
    for (const [key, meta] of Object.entries<{ png: string }>(manifest.assets)) {
      expect(files, key).toContain(meta.png.replace("png/", ""));
      expect(files, key).toContain(meta.png.replace("png/", "").replace(".png", "@2x.png"));
    }
  });

  test("NODI-02 mappa e misure dal manifest: quadrato del posto, mai sopra 88, niente sotto 32 né su fondo scuro", () => {
    for (const s of NODI_STATES) {
      const a = nodiAsset(s, 48)!;
      expect(a.src, s).toBe(`/assets/nodi/${manifest.states[s]}.png`);
      expect(a.src2x, s).toBe(`/assets/nodi/${manifest.states[s]}@2x.png`);
      expect(fs.existsSync(path.join(root, "public", a.src)), a.src).toBe(true);
      expect(fs.existsSync(path.join(root, "public", a.src2x)), a.src2x).toBe(true);
    }
    expect(nodiAsset("problem", 34)?.src).toBe("/assets/nodi/nodi-thread-state-03.png");
    expect(nodiAsset("discover-empty", 48)?.src).toBe("/assets/nodi/nodi-thread-state-08.png");
    expect(nodiAsset("welcome", 160)?.size).toBe(88);
    expect(nodiAsset("empty", 56)).toMatchObject({ size: 56, width: 81, height: 88 });
    // il pacchetto v2 non ha varianti per fondo scuro né una versione senza volto
    expect(nodiAsset("success", 32, true)).toBeNull();
    expect(nodiAsset("success", 31)).toBeNull();
    // misure dei posti = max_px del manifest
    expect(NODI_SIZE).toEqual({
      onboarding: manifest.placement.onboarding_children.max_px,
      plannerEmpty: manifest.placement.planner_empty_day.max_px,
      groupsEmpty: manifest.placement.groups_empty.max_px,
      homeHint: manifest.placement.home_get_started.max_px,
      problem: manifest.placement.who_does_what.max_px,
      discoverEmpty: manifest.placement.discover_no_results.max_px,
      toast: manifest.placement.assignment_success.max_px,
    });
  });

  test("NODI-03 dopo Chi accompagna: settimana completa o giorno completo = conferma (stato success), altrimenti niente", () => {
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 2 }, { dayMissing: 0, weekMissing: 0 })).toEqual({
      state: "success",
      text: NODI_COPY.weekDone,
    });
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 5 }, { dayMissing: 0, weekMissing: 3 })).toEqual({
      state: "success",
      text: "Fatto. Ora lo sanno tutti.",
    });
    // una scelta parziale, nessun cambio, o una settimana già a posto: niente
    expect(nodiAfterAssign({ dayMissing: 2, weekMissing: 5 }, { dayMissing: 1, weekMissing: 4 })).toBeNull();
    expect(nodiAfterAssign({ dayMissing: 0, weekMissing: 0 }, { dayMissing: 0, weekMissing: 0 })).toBeNull();
    expect(nodiAfterAssign({ dayMissing: 0, weekMissing: 3 }, { dayMissing: 0, weekMissing: 3 })).toBeNull();
    // foglio della settimana (nessun giorno): solo la settimana completa
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

  test("NODI-07 componente: <img> sui PNG del pacchetto (1x e @2x), decorativo, solo il ripiego se il flag è spento", () => {
    const src = read("components/nextgen/Nodi.tsx");
    // flag spento: nessun Nodi, solo il ripiego (di default nulla)
    expect(src).toMatch(/if \(!enabled\) return <>\{fallback\}<\/>;/);
    expect(src).toMatch(/fallback = null,/);
    expect(src).toMatch(/<img/);
    expect(src).toContain("srcSet={`${asset.src} 1x, ${asset.src2x} 2x`}");
    expect(src).toContain("object-contain");
    expect(src).toMatch(/aria-hidden=\{decorative \? true : undefined\}/);
    expect(src).toMatch(/alt=\{decorative \? "" :/);
    // nessuna ricostruzione della mascotte e nessun ritocco via CSS
    expect(src).not.toMatch(/<svg|<path|filter:|invert\(|hue-rotate|clip-path/);
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
    expect(planner).toMatch(/nodiProblem \? <Nodi state="problem" size=\{NODI_SIZE\.problem\} fallback=\{icon\} \/> : icon/);
    expect(planner).toMatch(/\{nodiProblem \? NODI_COPY\.problemTitle : "Chi fa cosa"\}/);
    // fogli Chi fa cosa / Chi accompagna: fotografia all'apertura, confronto alla chiusura
    expect(planner).toMatch(/panel === "chi" \? "chi" : panel !== null && typeof panel === "object" && "assign" in panel \? `assign:\$\{panel\.assign\}` : null/);
    expect(planner).toMatch(/\}, \[panelKey\]\);/);

    const groups = read("components/GroupsClient.tsx");
    expect(groups).toMatch(/v2 && nodiEnabled \?[\s\S]{0,200}?<Nodi state="group" size=\{NODI_SIZE\.groupsEmpty\}/);

    const discover = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(discover).toMatch(/v2 && nodiEnabled \?[\s\S]{0,800}?<Nodi state="discover-empty" size=\{NODI_SIZE\.discoverEmpty\} \/>/);

    // l'avviso è scuro e il pacchetto v2 non ha varianti scure: nessun Nodi nell'avviso
    expect(read("components/nextgen/NextgenToastProvider.tsx")).not.toMatch(/Nodi/);
    expect(planner).toContain('if (moment) showToast(moment.text, "success");');
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
    ]) {
      expect(read(f), f).not.toMatch(/<Nodi [^>]*size=\{\d+\}/);
    }
    // niente card nate per Nodi (la prima versione le aveva)
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).not.toContain("nodi-problem-card");
    expect(planner).not.toContain("nodi-planner-empty");
    // un solo Nodi per posto: sei posizionamenti in tutta l'app famiglie (l'avviso non ne ha)
    const uses = [
      "components/nextgen/OnboardingV2.tsx",
      "components/nextgen/SeasonSummaryCard.tsx",
      "app/nextgen/planner/PlannerV2Client.tsx",
      "components/nextgen/PlannerDayFocus.tsx",
      "components/GroupsClient.tsx",
      "app/nextgen/search/SearchDiscoveryClient.tsx",
    ].reduce((n, f) => n + (read(f).match(/<Nodi /g)?.length ?? 0), 0);
    expect(uses).toBe(6);
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
