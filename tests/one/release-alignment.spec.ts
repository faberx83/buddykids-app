import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";

// TRAMA — RIALLINEAMENTO GESTIONE FEATURE (13/10/2026, richiesta di Fabrizio:
// "riallineerei tutte le gestione delle feature a questa modalità").
// Ogni funzionalità accendibile per fasi (releaseEligible) deve comparire
// in UNA card di Admin → Feature Flags → Release, con i pulsanti
// Anteprima interna / Pilot / Pubblica a tutti — mai solo come override
// tecnico da creare a mano. Il Radar era rimasto fuori: questo test impedisce
// che una nuova funzionalità resti fuori di nuovo.
//
// Comando: npx playwright test tests/one/release-alignment.spec.ts

const ROOT = path.join(__dirname, "../..");

test.describe("Gestione feature — tutte dalla card Release", () => {
  test("REL-ALIGN-01: ogni funzionalità releaseEligible è in esattamente una release", () => {
    for (const feature of FEATURE_CATALOG.filter((f) => f.releaseEligible)) {
      const releases = RELEASE_CATALOG.filter((r) => r.featureKeys.includes(feature.key));
      expect(releases.map((r) => r.id), `${feature.key} deve stare in una sola release`).toHaveLength(1);
    }
  });

  test("REL-ALIGN-02: ogni funzionalità in una release ha un flag noto che ammette lo scope cohort", () => {
    for (const release of RELEASE_CATALOG) {
      for (const key of release.featureKeys) {
        const feature = FEATURE_CATALOG.find((f) => f.key === key);
        expect(feature, `${key} non è nel catalogo funzionalità`).toBeTruthy();
        expect(feature!.releaseEligible, `${key} in release ma non releaseEligible`).toBe(true);
        const flag = FEATURE_FLAG_REGISTRY[feature!.flagName as keyof typeof FEATURE_FLAG_REGISTRY];
        expect(flag, `${key}: flag ${feature!.flagName} sconosciuto`).toBeTruthy();
        expect((flag as { allowedScopes: readonly string[] }).allowedScopes).toContain("cohort");
      }
    }
  });

  test("REL-ALIGN-03: il Radar si gestisce dalla release di Scopri", () => {
    const release = RELEASE_CATALOG.find((r) => r.id === "real-discovery-pilot");
    expect(release?.featureKeys).toContain("radar_community_discovery");
  });

  test("REL-ALIGN-04: i file indicati dalle funzionalità in release esistono", () => {
    const keys = new Set(RELEASE_CATALOG.flatMap((r) => r.featureKeys));
    for (const feature of FEATURE_CATALOG.filter((f) => keys.has(f.key))) {
      for (const file of feature.sourceFiles ?? []) {
        expect(fs.existsSync(path.join(ROOT, file)), `${feature.key}: ${file}`).toBe(true);
      }
    }
  });
});
