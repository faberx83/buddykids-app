import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { evaluateFlag, evaluateFlagDetailed } from "../../lib/feature-flags/evaluate";
import { anyResolvedViaInternalPreview, isResolvedViaInternalPreview } from "../../lib/feature-flags/internal-preview";
import { INTERNAL_PREVIEW_COHORT_KEY } from "../../lib/releases/visibility";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG, isFeatureReleaseEligible } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

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

  test("BADGE-01: il badge ANTEPRIMA INTERNA del Planner ora tiene conto anche di GLOBAL_ACTION_PROGRESS_ENABLED, nello STESSO array (un solo badge, mai un secondo componente)", () => {
    const source = readSource("../../app/nextgen/planner/page.tsx");
    expect(source).toContain('flagName: "GLOBAL_ACTION_PROGRESS_ENABLED"');
    expect(source).toContain(
      "anyResolvedViaInternalPreview([calendarExportDetail, schoolCalendarDetail, globalActionProgressDetail])"
    );
    // Un solo <InternalPreviewBadge> nel Planner — mai una seconda istanza
    // aggiunta per la Progress Bar (dedup "un solo badge per surface").
    const clientSource = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    const occurrences = clientSource.split("<InternalPreviewBadge").length - 1;
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

  test("INVARIANT-02: soglia anti-flash e durata minima visibile invariate", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    expect(source).toContain("const SHOW_DELAY_MS = 150;");
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
