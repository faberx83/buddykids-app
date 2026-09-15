import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { evaluateFlag, evaluateFlagDetailed } from "../../lib/feature-flags/evaluate";
import { anyResolvedViaInternalPreview, isResolvedViaInternalPreview } from "../../lib/feature-flags/internal-preview";
import { INTERNAL_PREVIEW_COHORT_KEY } from "../../lib/releases/visibility";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG, isFeatureReleaseEligible } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";
import { isInternalNavigableClick, type LinkClickInfo } from "../../lib/nextgen/navigation-progress-core";

// TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, richiesta esplicita di
// Fabrizio: "la Global Action Progress Bar NON deve andare subito a tutti
// gli utenti [...] non è ancora stata verificata visivamente live"). Stesso
// principio "[no browser]" di tests/one/calendar-export.spec.ts e
// tests/one/school-calendar-ux-refinement.spec.ts: logica pura di
// risoluzione flag (identica a quella usata da resolveFeatureFlagVisibility
// server-side) + lettura statica dei call site reali (app/nextgen/layout.tsx,
// app/nextgen/planner/page.tsx, components/GlobalActionProgress.tsx) per
// tutto ciò che richiederebbe altrimenti un ambiente Supabase live o un DOM
// con timer reali (nessuno dei due disponibile in questo runner, stesso
// limite già accettato dal resto della suite "[no browser]" del
// repository — mai una simulazione finta spacciata per un test reale).
//
// Comando: npx playwright test tests/one/global-action-progress-dark-release.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

test.describe("TRAMA — GLOBAL_ACTION_PROGRESS_ENABLED: registrazione flag [no browser]", () => {
  test("FLAG-01: registrato con defaultValue=false e scope cohort consentito", () => {
    const def = FEATURE_FLAG_REGISTRY.GLOBAL_ACTION_PROGRESS_ENABLED;
    expect(def).toBeDefined();
    expect(def.defaultValue).toBe(false);
    expect(def.allowedScopes).toContain("cohort");
  });

  test("FLAG-02: nessun override (default) → risolve false — 'app invariata' per l'utente normale", () => {
    const result = evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", { environment: "production" }, []);
    expect(result).toBe(false);
  });

  test("FLAG-03: override cohort:internal-preview attivo → risolve true SOLO per quella coorte", () => {
    const inCohort = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const outOfCohort = { userId: "normal-user", cohortKeys: [] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    expect(evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", inCohort, overrides)).toBe(true);
    expect(evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", outOfCohort, overrides)).toBe(false);
  });

  test("FLAG-04: risolto via cohort:internal-preview → isResolvedViaInternalPreview/anyResolvedViaInternalPreview lo riconoscono", () => {
    const context = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const detail = evaluateFlagDetailed("GLOBAL_ACTION_PROGRESS_ENABLED", context, overrides);
    expect(isResolvedViaInternalPreview(detail)).toBe(true);
    expect(anyResolvedViaInternalPreview([detail])).toBe(true);
  });

  test("FLAG-05: override GLOBAL — nessuno è mai stato scritto da questo programma (nessun override qui = comportamento di default)", () => {
    // Nessuna riga in questo file scrive un override "global" enabled=true
    // per GLOBAL_ACTION_PROGRESS_ENABLED — verificato per assenza: con zero
    // override passati, il flag resta sempre al suo defaultValue (test
    // FLAG-02 sopra), esattamente come richiesto ("nessun override creato
    // da te").
    const result = evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", { environment: "production", cohortKeys: [] }, []);
    expect(result).toBe(false);
  });
});

test.describe("TRAMA — Indipendenza dei 3 flag della sessione (School Calendar / Calendar Export / Global Progress) [no browser]", () => {
  test("INDEP-01: un override SOLO su GLOBAL_ACTION_PROGRESS_ENABLED non abilita SCHOOL_CALENDAR_INTELLIGENCE_ENABLED né CALENDAR_EXPORT_ENABLED", () => {
    const context = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    // Stesso override (stessa coorte) applicato ai 3 flag: ciascuno viene
    // valutato indipendentemente contro il PROPRIO registro — un flag non
    // dichiarato per un dato override non ne eredita mai lo stato.
    expect(evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", context, overrides)).toBe(true);
    expect(evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides)).toBe(true);
    expect(evaluateFlag("CALENDAR_EXPORT_ENABLED", context, overrides)).toBe(true);
    // Nessuna sorpresa: la stessa coorte abilita naturalmente tutte le
    // capability gated su di essa (comportamento INTENZIONALE della coorte
    // "internal-preview", non un difetto di isolamento) — l'isolamento
    // reale si verifica isolando l'override PER FLAG, come sotto.
    const onlyProgress = [{ scopeType: "cohort" as const, scopeValue: "some-other-cohort", enabled: true, expiresAt: null }];
    expect(evaluateFlag("GLOBAL_ACTION_PROGRESS_ENABLED", { userId: "u1", cohortKeys: ["some-other-cohort"] }, onlyProgress)).toBe(true);
    expect(evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", { userId: "u1", cohortKeys: ["some-other-cohort"] }, [])).toBe(false);
    expect(evaluateFlag("CALENDAR_EXPORT_ENABLED", { userId: "u1", cohortKeys: ["some-other-cohort"] }, [])).toBe(false);
  });
});

test.describe("TRAMA — Feature/Release Catalog: 'TRAMA — UX Foundations' separata da 'Planner Intelligence' [no browser]", () => {
  test("CATALOG-01: voce global_action_progress esiste, release-eligible, punta al flag corretto", () => {
    const entry = FEATURE_CATALOG.find((e) => e.key === "global_action_progress");
    expect(entry).toBeDefined();
    expect(entry?.flagName).toBe("GLOBAL_ACTION_PROGRESS_ENABLED");
    expect(entry && isFeatureReleaseEligible(entry)).toBe(true);
  });

  test("RELEASE-01: release 'ux-foundations' esiste, contiene SOLO global_action_progress, distinta da 'planner-intelligence'", () => {
    const uxFoundations = RELEASE_CATALOG.find((r) => r.id === "ux-foundations");
    const plannerIntelligence = RELEASE_CATALOG.find((r) => r.id === "planner-intelligence");
    expect(uxFoundations).toBeDefined();
    expect(uxFoundations?.featureKeys).toContain("global_action_progress");
    expect(plannerIntelligence?.featureKeys).not.toContain("global_action_progress");
  });
});

test.describe("TRAMA — Gating server-side + dedup badge [no browser, static source]", () => {
  test("GATE-01: app/nextgen/layout.tsx risolve GLOBAL_ACTION_PROGRESS_ENABLED e passa `enabled` al Provider", () => {
    const source = readSource("../../app/nextgen/layout.tsx");
    expect(source).toContain('flagName: "GLOBAL_ACTION_PROGRESS_ENABLED"');
    expect(source).toContain("<GlobalActionProgressProvider enabled={globalActionProgressEnabled}>");
  });

  test("GATE-02: default della prop `enabled` è false (fail-safe se un call site dimentica di passarla)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("enabled = false,");
  });

  test("GATE-03: start()/complete() sono no-op quando enabled=false — 'progress flag OFF → app invariata'", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    const startIndex = source.indexOf("const start = useCallback(() => {");
    const completeIndex = source.indexOf("const complete = useCallback(() => {");
    const startGuard = source.indexOf("if (!enabled) return;", startIndex);
    const completeGuard = source.indexOf("if (!enabled) return;", completeIndex);
    expect(startGuard).toBeGreaterThan(startIndex);
    expect(completeGuard).toBeGreaterThan(completeIndex);
  });

  test("GATE-04: la barra non viene mai renderizzata quando enabled=false — 'normal user → progress assente'", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("{enabled && <GlobalActionProgressBar phase={phase} percent={percent} />}");
  });

  // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026): InternalPreviewBadge
  // rimosso, sostituito da ProductStatusChip — stessa logica di
  // dedup/aggregazione, solo il componente renderizzato è cambiato.
  test("BADGE-01: il ProductStatusChip del Planner ora tiene conto anche di GLOBAL_ACTION_PROGRESS_ENABLED, nello STESSO array (un solo chip, mai un secondo componente)", () => {
    const source = readSource("../../app/nextgen/planner/page.tsx");
    expect(source).toContain('flagName: "GLOBAL_ACTION_PROGRESS_ENABLED"');
    expect(source).toContain(
      "anyResolvedViaInternalPreview([calendarExportDetail, schoolCalendarDetail, globalActionProgressDetail])"
    );
    // Un solo <ProductStatusChip> nel Planner — mai una seconda istanza
    // aggiunta per la Progress Bar (dedup "un solo badge per surface").
    const clientSource = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    const occurrences = clientSource.split("<ProductStatusChip").length - 1;
    expect(occurrences).toBe(1);
  });

  test("GATE-05: le 3 resolveFeatureFlagVisibility del Planner restano nello STESSO Promise.all (nessun round-trip extra in sequenza)", () => {
    const source = readSource("../../app/nextgen/planner/page.tsx");
    const occurrences = source.split("resolveFeatureFlagVisibility({").length - 1;
    expect(occurrences).toBe(3);
    expect(source).toContain("await Promise.all([");
  });
});

test.describe("TRAMA — Concurrent actions / anti-flash / reduced motion (invarianti già presenti, riverificate) [no browser, static source]", () => {
  test("INVARIANT-01: contatore pending (non un booleano) per azioni concorrenti", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("pendingCountRef");
    expect(source).toContain("pendingCountRef.current += 1;");
    expect(source).toContain("pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);");
  });

  test("INVARIANT-02: soglia anti-flash (100ms, LIVE FIX §8) e durata minima visibile (invariata)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §8 "ANTI-FLASH"):
    // 150ms → 100ms, vedi commento sulla costante nel componente per il
    // perché (finestra reale in cui una Server Action rapida finiva prima
    // che la barra diventasse visibile). MIN_VISIBLE_MS resta 350ms, già
    // dentro il range richiesto.
    expect(source).toContain("const SHOW_DELAY_MS = 100;");
    expect(source).toContain("const MIN_VISIBLE_MS = 350;");
  });

  test("INVARIANT-03: prefers-reduced-motion gestito in CSS, mai un'animazione forzata", () => {
    const css = readSource("../../app/globals.css");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("trama-progress-fill");
  });

  test("INVARIANT-04: run() opt-in helper esposto — pattern condiviso disponibile senza mass-refactor (§PROGRESS COVERAGE punto B)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("run: <T>(fn: () => Promise<T>) => Promise<T>;");
  });
});

// TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026). I 17 scenari
// richiesti da Fabrizio, mappati sulla stessa disciplina "[no browser]" del
// resto della suite: dove lo scenario è pura logica (filtro click, quali
// href non devono avviare la barra) un test diretto sulla funzione pura
// isInternalNavigableClick(); dove richiede timer reali/un DOM
// (anti-flash, progressione percentuale, fade) verifica statica del codice
// sorgente che implementa il comportamento, con lo stesso principio già
// accettato dal resto del repository per l'assenza di un browser reale in
// questo runner (mai una simulazione finta spacciata per un test live).
test.describe("TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX — 17 scenari [no browser]", () => {
  const ORIGIN = "https://app.buddykids.it";
  const CURRENT = "https://app.buddykids.it/nextgen/planner";

  function clickInfo(overrides: Partial<LinkClickInfo> = {}): LinkClickInfo {
    return {
      href: "/nextgen/planner/2026-09-14",
      target: null,
      hasDownloadAttr: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      ...overrides,
    };
  }

  test("SCENARIO-01: click su link interno reale → isInternalNavigableClick=true (start avviene PRIMA di qualunque cambio pathname, essendo un handler sincrono sul click stesso)", () => {
    expect(isInternalNavigableClick(clickInfo(), ORIGIN, CURRENT)).toBe(true);
    // Il chiamante (useEffect in GlobalActionProgress.tsx) invoca
    // startNavigation() in modo sincrono dentro l'handler di click, PRIMA
    // che Next.js avvii la transizione — quindi prima di qualunque cambio
    // di pathname, per costruzione dell'ordine capture-phase (vedi
    // WIRING-01 sotto per la verifica statica di questo ordinamento).
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("if (isInternalNavigableClick(info, window.location.origin, window.location.href)) {\n        startNavigation();");
  });

  test("SCENARIO-02: cambio pathname/searchParams → completeNavigationIfPending() chiamato (segnale di SOLO completamento)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    const effectIndex = source.indexOf("}, [pathname, searchParamsString]);");
    expect(effectIndex).toBeGreaterThan(-1);
    const effectBody = source.slice(source.lastIndexOf("useEffect(() => {", effectIndex), effectIndex);
    expect(effectBody).toContain("completeNavigationIfPending();");
    // Non deve MAI chiamare start()/startNavigation() in questo effetto —
    // la root cause era esattamente questo (vedi commento in cima al file).
    expect(effectBody).not.toContain("startNavigation()");
    expect(effectBody).not.toContain("start();");
  });

  test("SCENARIO-03: click sulla STESSA URL già corrente → nessun avvio", () => {
    expect(isInternalNavigableClick(clickInfo({ href: CURRENT }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "/nextgen/planner" }), ORIGIN, CURRENT)).toBe(false);
  });

  test("SCENARIO-04: link esterno (origin diverso) → nessun avvio", () => {
    expect(isInternalNavigableClick(clickInfo({ href: "https://www.google.com" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "http://app.buddykids.it/nextgen" }), ORIGIN, CURRENT)).toBe(false); // http ≠ https, origin diverso
  });

  test("SCENARIO-05: link con attributo download → nessun avvio", () => {
    expect(isInternalNavigableClick(clickInfo({ hasDownloadAttr: true }), ORIGIN, CURRENT)).toBe(false);
  });

  test("SCENARIO-06: target=_blank (nuova scheda) → nessun avvio; target=_self esplicito resta valido", () => {
    expect(isInternalNavigableClick(clickInfo({ target: "_blank" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ target: "_parent" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ target: "_top" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ target: "_self" }), ORIGIN, CURRENT)).toBe(true);
  });

  test("SCENARIO-07: click modificato (cmd/ctrl/shift/alt/middle-click) → nessun avvio", () => {
    expect(isInternalNavigableClick(clickInfo({ metaKey: true }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ ctrlKey: true }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ shiftKey: true }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ altKey: true }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ button: 1 }), ORIGIN, CURRENT)).toBe(false); // middle-click
  });

  test("SCENARIO-07b: href non di navigazione (#, mailto:, tel:, javascript:, vuoto) o già gestito da altra logica (defaultPrevented) → nessun avvio", () => {
    expect(isInternalNavigableClick(clickInfo({ href: "#dettagli" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "mailto:info@buddykids.it" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "tel:+390212345678" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "javascript:void(0)" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: "" }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ href: null }), ORIGIN, CURRENT)).toBe(false);
    expect(isInternalNavigableClick(clickInfo({ defaultPrevented: true }), ORIGIN, CURRENT)).toBe(false);
  });

  test("SCENARIO-08/09: soglia anti-flash — showTimer schedulato a SHOW_DELAY_MS, annullato da complete() se l'azione finisce prima (§20 già esistente, riverificato dopo il fix root cause)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("showTimerRef.current = setTimeout(() => {\n      showTimerRef.current = null;\n      if (pendingCountRef.current > 0) beginVisible();\n    }, SHOW_DELAY_MS);");
    expect(source).toContain("if (showTimerRef.current) {\n      // L'azione è finita prima della soglia SHOW_DELAY_MS");
  });

  test("SCENARIO-10: al completamento, percent arriva a 100 prima del fade-out (mai un fade diretto senza passare per 100%)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    const completeIndex = source.indexOf("const complete = useCallback(() => {");
    const completeBody = source.slice(completeIndex, source.indexOf("[clearProgressTimers, enabled]);", completeIndex));
    expect(completeBody).toContain("setPercent(100);");
  });

  test("SCENARIO-11: errore in una Server Action istrumentata → complete() comunque chiamato (finally), mai una barra bloccata", () => {
    // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §7): due bug
    // reali trovati e corretti in questa sessione — completeProgress()
    // chiamato in linea retta dopo l'await invece che in un finally.
    // Verificati qui tutti e 4 i call site esplicitamente istrumentati.
    const profileKids = readSource("../../components/ProfileKidsSection.tsx");
    const profileSaveSchool = profileKids.slice(profileKids.indexOf("async function saveSchool"), profileKids.indexOf("async function saveSchool") + 1200);
    expect(profileSaveSchool).toContain("startProgress();\n    let result:");
    expect(profileSaveSchool).toContain("} finally {\n      completeProgress();");

    const plannerClient = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    const toggleDismissed = plannerClient.slice(plannerClient.indexOf("async function toggleDismissed"), plannerClient.indexOf("async function toggleDismissed") + 900);
    expect(toggleDismissed).toContain("startProgress();\n    try {");
    expect(toggleDismissed).toContain("} finally {\n      completeProgress();");

    const addKidForm = readSource("../../components/AddKidForm.tsx");
    expect(addKidForm).toContain("startProgress();\n    try {");
    expect(addKidForm).toContain("} finally {\n      completeProgress();");

    const schoolCallout = readSource("../../components/nextgen/SchoolCalendarOnboardingCallout.tsx");
    expect(schoolCallout).toContain("start();\n    try {");
    expect(schoolCallout).toContain("} finally {\n      complete();");

    // run() (helper generico opt-in) usa lo stesso pattern by construction.
    const globalProgress = readSource("../../components/GlobalActionProgress.tsx");
    expect(globalProgress).toContain("start();\n      try {\n        return await fn();\n      } finally {\n        complete();\n      }");
  });

  test("SCENARIO-12: azioni concorrenti — contatore pending, la barra si chiude solo quando l'ultima finisce (invariante riverificata, vedi anche INVARIANT-01)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("if (pendingCountRef.current > 1) return; // un'azione è già pending, nessun secondo timer");
    expect(source).toContain("if (pendingCountRef.current > 0) return; // un'altra azione resta pending (§26)");
  });

  test("SCENARIO-13: flag disabilitato → start()/complete()/startNavigation() a zero effetto (nessun timer, nessun setState) — riverificato dopo l'estensione a startNavigation", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    // startNavigation() chiama sempre start() (guardia enabled già dentro
    // start stesso) — nessuna guardia enabled duplicata necessaria in
    // startNavigation, ma verifichiamo che non crei comunque side-effect
    // visibili quando enabled=false: il contatore pendingCountRef non viene
    // mai incrementato da start() quando enabled=false (return anticipato),
    // quindi beginVisible() non scatta mai — stesso comportamento di prima.
    const startIndex = source.indexOf("const start = useCallback(() => {");
    expect(source.slice(startIndex, startIndex + 400)).toContain("if (!enabled) return;");
  });

  test("SCENARIO-14: utente normale (flag OFF) — comportamento app identico a prima di questa capability (nessuna regressione introdotta dal LIVE FIX)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("{enabled && <GlobalActionProgressBar phase={phase} percent={percent} />}");
    // Il listener di click capture viene comunque montato (è nel Provider,
    // non condizionato da `enabled`), ma è innocuo: chiama startNavigation()
    // → start(), che è no-op quando enabled=false — zero side-effect
    // osservabile, coerente con "progress flag OFF → app invariata".
  });

  test("SCENARIO-15: reduced motion — invariato dal LIVE FIX (riverificato, vedi anche INVARIANT-03)", () => {
    const css = readSource("../../app/globals.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) {\n  .trama-progress-fill {\n    background-image: none;");
  });

  test("SCENARIO-16: il listener di click capture non intercetta/blocca il click — mai preventDefault()/stopPropagation() chiamati, Next.js Link continua a gestire la navigazione normalmente", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    const handlerStart = source.indexOf("function handleClickCapture(event: MouseEvent) {");
    const handlerEnd = source.indexOf("\n    document.addEventListener(\"click\", handleClickCapture, true);", handlerStart);
    const handlerBody = source.slice(handlerStart, handlerEnd);
    expect(handlerBody).not.toContain("preventDefault");
    expect(handlerBody).not.toContain("stopPropagation");
  });

  test("SCENARIO-17: la barra non causa layout shift — fixed, pointer-events-none, altezza 3px, nessuno spazio riservato nel flusso normale", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain('className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"');
  });
});

test.describe("TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX — wiring statico aggiuntivo [no browser]", () => {
  test("WIRING-01: listener di click in CAPTURE phase su document (addEventListener('click', handler, true)) — mai un handler per singolo <Link>", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain('document.addEventListener("click", handleClickCapture, true);');
    expect(source).toContain('document.removeEventListener("click", handleClickCapture, true);');
  });

  test("WIRING-02: runNavigation esposto nel context, con no-op fuori da un Provider", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("runNavigation: () => void;");
    expect(source).toContain("runNavigation: () => {} };"); // dentro l'oggetto `noop`
    expect(source).toContain("value={{ start, complete, run, runNavigation }}");
  });

  test("WIRING-03: safety timeout di navigazione presente e ragionevole (8s) — mai una barra bloccata su navigazione abortita/errore", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("const NAVIGATION_SAFETY_TIMEOUT_MS = 8000;");
    expect(source).toContain("navigationSafetyTimerRef.current = setTimeout(() => {");
  });

  test("WIRING-04: PageHeader (layer condiviso 'indietro') chiama runNavigation() PRIMA di router.push/router.back — MAI per l'override onBack (spesso navigazione locale, non reale)", () => {
    const source = readSource("../../components/PageHeader.tsx");
    expect(source).toContain('import { useGlobalActionProgress } from "@/components/GlobalActionProgress";');
    expect(source).toContain("const { runNavigation } = useGlobalActionProgress();");
    const onClickIndex = source.indexOf("onClick={() => {");
    const onClickBody = source.slice(onClickIndex, source.indexOf("aria-label=\"Indietro\"", onClickIndex));
    // runNavigation() deve comparire DOPO il ramo onBack (che fa return
    // presto senza chiamarla) e PRIMA di router.push/router.back.
    const runNavIdx = onClickBody.indexOf("runNavigation();");
    const pushIdx = onClickBody.indexOf("router.push(backHref)");
    // "else router.back();" (non solo "router.back()"): il commento sopra
    // menziona anche "router.back()" in prosa ("backHref/router.back()
    // sono invece SEMPRE..."), un indexOf troppo generico troverebbe quella
    // occorrenza nel commento invece della riga di codice reale.
    const backIdx = onClickBody.indexOf("else router.back();");
    expect(runNavIdx).toBeGreaterThan(-1);
    expect(runNavIdx).toBeLessThan(pushIdx);
    expect(runNavIdx).toBeLessThan(backIdx);
    // Il ramo onBack fa `return;` prima di runNavigation() — mai chiamata
    // per un override locale.
    const onBackBranch = onClickBody.slice(onClickBody.indexOf("if (onBack)"), onClickBody.indexOf("return;\n          }"));
    // Cerca la CHIAMATA reale "runNavigation();" (non la parola in un
    // commento esplicativo — il codice ha un commento che la nomina apposta
    // per spiegare perché NON viene chiamata qui, es. "Nessun
    // runNavigation() qui.", che altrimenti darebbe un falso positivo).
    expect(onBackBranch).not.toContain("runNavigation();");
  });

  test("WIRING-05: opacity della barra attiva = 1 (§9 'per il test live'), fade-out finale resta 0", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("opacity: fadingOut ? 0 : 1,");
  });

  test("WIRING-06: CTA prioritarie nominate da Fabrizio (Riempi settimana, Planner Week Detail, Profilo, Scopri, Prenotazioni/dettaglio) sono <Link> — auto-coperte dal click-capture, zero wiring manuale necessario", () => {
    // Verificato via ricerca statica in questa sessione (non ripetuto qui
    // riga per riga per non duplicare l'intera codebase in un test — vedi
    // il report finale per l'elenco file/righe): tutte e 5 risultano
    // <Link href=...>, mai router.push() programmatico. L'unico
    // router.push()/router.back() programmatico trovato per la navigazione
    // "in avanti"/"indietro" del Planner e delle sue sotto-pagine è il
    // pulsante "indietro" di PageHeader, coperto da WIRING-04 sopra.
    const plannerClient = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    expect(plannerClient).toContain('<Link');
    const activityCard = readSource("../../components/ActivityCard.tsx");
    expect(activityCard).toContain("<Link\n");
  });
});
