// TRAMA — NODI THREAD (28/10/2026). Asset del pacchetto approvato
// TRAMA_NODI_THREAD_REFERENCE_PACK_v2 (28/10 sera, al posto del v1.0) dietro
// NODI_ENABLED. [no browser]

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { test, expect } from "@playwright/test";
import {
  CHI_E_NODI_COPY,
  NODI_COPY,
  NODI_FLAG,
  NODI_CROP,
  NODI_MAX_PX,
  NODI_SIZE,
  nodiCropLayout,
  NODI_STATES,
  isPlannerWeekEmpty,
  nodiAfterAssign,
  nodiAsset,
} from "../../lib/nextgen/nodi";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { ONBOARDING_V2_SLIDES } from "../../lib/nextgen/onboarding-v2";

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
    // misure dei posti: max_px del manifest, alzate di 4–8 px il 29/10 ("un pelino più grande e visibile");
    // "Chi fa cosa" resta 34 (prende il posto di un'icona da 34) e nessun posto supera 88
    const m = (k: string) => manifest.placement[k].max_px as number;
    expect(NODI_SIZE.problem).toBe(m("who_does_what"));
    expect(NODI_SIZE.toast).toBe(m("assignment_success"));
    for (const [k, key] of [
      ["onboarding", "onboarding_children"],
      ["plannerEmpty", "planner_empty_day"],
      ["groupsEmpty", "groups_empty"],
      ["homeHint", "home_get_started"],
      ["discoverEmpty", "discover_no_results"],
    ] as const) {
      expect(NODI_SIZE[k], k).toBeGreaterThanOrEqual(m(key));
      expect(NODI_SIZE[k], k).toBeLessThanOrEqual(m(key) + 8);
    }
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
    // si vede solo la parte con Nodi: quadrato con overflow nascosto, posizione da nodiCropLayout
    expect(src).toContain("overflow-hidden");
    expect(src).toContain("const fit = nodiCropLayout(asset);");
    expect(src).toMatch(/aria-hidden=\{decorative \? true : undefined\}/);
    // 29/10: il nome accessibile sta sul quadrato (role img) quando non è decorativo; l'immagine dentro è muta
    expect(src).toContain("aria-label={decorative ? undefined : `Nodi: ${state}`}");
    expect(src).toMatch(/<img[\s\S]*?alt=""/);
    // nessuna ricostruzione della mascotte e nessun ritocco del colore via CSS;
    // l'unico clip-path è quello calcolato da NODI_CROP (angolo del fumetto di state-03)
    expect(src).not.toMatch(/<svg|<path|filter:|invert\(|hue-rotate|clip-path:/);
    expect(src).toContain("...(fit.clipPath ? { clipPath: fit.clipPath } : null)");
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
    // 29/10: due posti nell'onboarding — passo dei figli e card della terza schermata (stesso <Nodi> per le due card)
    expect(onb.match(/<Nodi /g)?.length).toBe(2);

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
    // 29/10: "un pelino più grande" — onboarding max 80 (era 72), empty 64, contestuali 48–56
    expect(NODI_SIZE.onboarding).toBeLessThanOrEqual(80);
    expect(NODI_SIZE.plannerEmpty).toBeGreaterThanOrEqual(56);
    expect(NODI_SIZE.plannerEmpty).toBeLessThanOrEqual(64);
    expect(NODI_SIZE.groupsEmpty).toBeLessThanOrEqual(72);
    expect(NODI_SIZE.homeHint).toBeLessThanOrEqual(48);
    expect(NODI_SIZE.problem).toBeGreaterThanOrEqual(32);
    expect(NODI_SIZE.problem).toBeLessThanOrEqual(48);
    expect(NODI_SIZE.discoverEmpty).toBeLessThanOrEqual(56);
    expect(NODI_SIZE.about).toBeLessThanOrEqual(64);
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
    // un solo Nodi per posto: nove posizionamenti (sei momenti, "Chi è Nodi", onboarding terza schermata, dettaglio gruppo; l'avviso non ne ha)
    const uses = [
      "components/nextgen/OnboardingV2.tsx",
      "components/nextgen/SeasonSummaryCard.tsx",
      "app/nextgen/planner/PlannerV2Client.tsx",
      "components/nextgen/PlannerDayFocus.tsx",
      "components/GroupsClient.tsx",
      "app/nextgen/search/SearchDiscoveryClient.tsx",
      "components/nextgen/ChiENodi.tsx",
      "components/GroupDetailClient.tsx",
    ].reduce((n, f) => n + (read(f).match(/<Nodi\s/g)?.length ?? 0), 0);
    // 29/10: + card della terza schermata dell'onboarding e testa del dettaglio gruppo
    expect(uses).toBe(9);
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
  test("NODI-12 ritaglio (29/10): solo Nodi, senza i pezzi dei vicini; file intatti; Chi è Nodi solo col flag", () => {
    // ogni asset del manifest ha il suo ritaglio, dentro l'immagine
    for (const key of Object.keys(manifest.assets)) {
      const c = NODI_CROP[key];
      expect(c, key).toBeTruthy();
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1.0001);
      expect(c.y + c.h).toBeLessThanOrEqual(1.0001);
    }
    // i frammenti delle etichette stanno in fondo alla tavola: il ritaglio li lascia fuori
    for (const key of ["nodi-thread-state-05", "nodi-thread-state-06", "nodi-thread-state-07", "nodi-thread-state-08"]) {
      expect(NODI_CROP[key].y + NODI_CROP[key].h, key).toBeLessThan(0.9);
    }
    // state-03: fumetto tagliato nascosto con l'angolo in alto a destra
    expect(NODI_CROP["nodi-thread-state-03"].hideTopRight).toEqual({ x: 0.6856, y: 0.285 });
    // posizione: il ritaglio riempie il quadrato (lato lungo = size) ed è centrato
    const a = nodiAsset("discover-empty", 56)!;
    const f = nodiCropLayout(a);
    const cw = a.crop.w * f.width;
    const ch = a.crop.h * f.height;
    expect(Math.max(cw, ch)).toBeCloseTo(56, 0);
    expect(f.left + a.crop.x * f.width).toBeCloseTo((56 - cw) / 2, 0);
    expect(f.top + a.crop.y * f.height).toBeCloseTo((56 - ch) / 2, 0);
    expect(f.clipPath).toBeNull();
    expect(nodiCropLayout(nodiAsset("problem", 34)!).clipPath).toBe("polygon(0 0, 68.6% 0, 68.6% 28.5%, 100% 28.5%, 100% 100%, 0 100%)");

    // "Chi è Nodi" nella pagina Cos'è TRAMA, solo con NODI_ENABLED, stessa forma di "Come funziona"
    const chi = read("components/nextgen/ChiENodi.tsx");
    expect(chi).toContain("if (!enabled) return null;");
    expect(chi).toContain('className="flex flex-col gap-3 rounded-2xl border border-trama-line bg-white p-[18px]"');
    expect(chi).toMatch(/<Nodi state="welcome" size=\{NODI_SIZE\.about\} \/>/);
    expect(CHI_E_NODI_COPY.title).toBe("Chi è Nodi");
    for (const v of Object.values(CHI_E_NODI_COPY)) expect(v).not.toMatch(/\bio\b|sono Nodi|posso aiutarti|!/i);
    const page = read("app/nextgen/trama/page.tsx");
    expect(page.indexOf("<ChiENodi />")).toBeGreaterThan(page.indexOf('id="come-h"'));
    expect(page.indexOf("<ChiENodi />")).toBeLessThan(page.indexOf('aria-label="Informazioni"'));
  });
  test("NODI-13 onboarding, terza schermata: Nodi nelle due card (nodo e nodo sciolto), più grande; dettaglio gruppo", () => {
    const chi = ONBOARDING_V2_SLIDES.find((s) => s.key === "chi")!;
    expect(chi.pops.map((p) => p.nodi)).toEqual(["problem", "success"]);
    // solo la terza schermata
    for (const s of ONBOARDING_V2_SLIDES.filter((x) => x.key !== "chi")) {
      expect(s.pops.every((p) => !p.nodi), s.key).toBe(true);
    }
    expect(NODI_SIZE.onboardingPop).toBe(48);
    expect(NODI_SIZE.groupHeader).toBe(56);
    const onb = read("components/nextgen/OnboardingV2.tsx");
    expect(onb).toContain("return pop.nodi ? <Nodi state={pop.nodi} size={NODI_SIZE.onboardingPop} className=\"-my-1 -ml-1\" fallback={icon} /> : icon;");
    // il logo resta quello di TRAMA, il telefono e i testi non cambiano
    expect(onb).toMatch(/src="\/brand\/trama-logo-mark\.png"/);
    // dettaglio gruppo: Nodi al posto del monogramma (56 px come il riquadro), il monogramma come ripiego
    const g = read("components/GroupDetailClient.tsx");
    expect(g).toMatch(/<Nodi\s+state="group"\s+size=\{NODI_SIZE\.groupHeader\}\s+fallback=\{/);
    expect(g).toContain("{monogramFor(detail.name)}");
    // la lista dei gruppi resta con i monogrammi (più gruppi = più Nodi nella stessa schermata)
    expect(read("components/GroupsClient.tsx")).toContain("{monogramFor(g.name)}");
  });
});
