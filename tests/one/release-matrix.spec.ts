// TRAMA — RELEASE: TABELLA (14/10/2026). Logica pura della tabella
// funzionalità × pubblico in Admin → Feature Flags → Release, più controlli
// sul sorgente: stessa azione delle card, nessun controllo sulle funzionalità
// non pronte, "GLOBAL" obbligatorio per "Tutti". [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  RELEASE_MATRIX_COLUMNS,
  isVisibleInColumn,
  matrixClickTarget,
  matrixClickConfirmText,
} from "../../lib/releases/visibility";
import { computeScopeOverrideTargetsForVisibility } from "../../lib/releases/promotion-validation";
import { INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY } from "../../lib/releases/visibility";

const MATRIX_SRC = fs.readFileSync(path.join(__dirname, "../../app/admin/feature-flags/ReleaseMatrix.tsx"), "utf-8");
const SECTION_SRC = fs.readFileSync(path.join(__dirname, "../../app/admin/feature-flags/ReleaseAdminSection.tsx"), "utf-8");

test.describe("TRAMA — Release: tabella funzionalità × pubblico [no browser]", () => {
  test("RM-01 tre colonne nell'ordine Anteprima interna, Pilot, Tutti", () => {
    expect(RELEASE_MATRIX_COLUMNS.map((c) => c.key)).toEqual(["internal_preview", "pilot", "global"]);
    expect(RELEASE_MATRIX_COLUMNS.map((c) => c.label)).toEqual(["Anteprima interna", "Pilot", "Tutti"]);
  });

  test("RM-02 spunte cumulative", () => {
    const row = (v: Parameters<typeof isVisibleInColumn>[0]) => RELEASE_MATRIX_COLUMNS.map((c) => isVisibleInColumn(v, c.key));
    expect(row("disabled")).toEqual([false, false, false]);
    expect(row("internal_preview")).toEqual([true, false, false]);
    expect(row("pilot")).toEqual([true, true, false]);
    expect(row("global")).toEqual([true, true, true]);
  });

  test("RM-03 le spunte coincidono con gli override reali scritti dall'azione", () => {
    for (const v of ["disabled", "internal_preview", "pilot", "global"] as const) {
      const targets = computeScopeOverrideTargetsForVisibility(v);
      const internal = targets.find((t) => t.scopeType === "cohort" && t.scopeValue === INTERNAL_PREVIEW_COHORT_KEY)!.enabled;
      const pilot = targets.find((t) => t.scopeType === "cohort" && t.scopeValue === PILOT_COHORT_KEY)!.enabled;
      const global = targets.find((t) => t.scopeType === "global")!.enabled;
      expect([internal, pilot, global]).toEqual(RELEASE_MATRIX_COLUMNS.map((c) => isVisibleInColumn(v, c.key)));
    }
  });

  test("RM-04 click su casella vuota = accendi fino a lì", () => {
    expect(matrixClickTarget("disabled", "internal_preview")).toBe("internal_preview");
    expect(matrixClickTarget("disabled", "pilot")).toBe("pilot");
    expect(matrixClickTarget("internal_preview", "global")).toBe("global");
  });

  test("RM-05 click su casella spuntata = torna alla colonna precedente", () => {
    expect(matrixClickTarget("internal_preview", "internal_preview")).toBe("disabled");
    expect(matrixClickTarget("pilot", "pilot")).toBe("internal_preview");
    expect(matrixClickTarget("global", "global")).toBe("pilot");
    expect(matrixClickTarget("global", "internal_preview")).toBe("disabled");
    expect(matrixClickTarget("pilot", "internal_preview")).toBe("disabled");
  });

  test("RM-06 testo di conferma in parole semplici", () => {
    expect(matrixClickConfirmText("Scopri V2", "internal_preview", "pilot")).toBe('Accendere "Scopri V2" fino a: Pilot?');
    expect(matrixClickConfirmText("Scopri V2", "pilot", "internal_preview")).toBe('Riportare "Scopri V2" a: Anteprima interna?');
    expect(matrixClickConfirmText("Scopri V2", "pilot", "disabled")).toBe('Spegnere "Scopri V2" per tutti?');
  });

  test("RM-07 la tabella usa la stessa azione delle card, con GLOBAL per 'Tutti'", () => {
    expect(MATRIX_SRC).toContain("setFeatureVisibilityAction(feature.flagName, target, confirmText)");
    expect(MATRIX_SRC).toContain('if (target === "global")');
    expect(MATRIX_SRC).toContain("Scrivi GLOBAL per confermare");
  });

  test("RM-08 nessun controllo per funzionalità non pronte o senza flag", () => {
    expect(MATRIX_SRC).toContain("const editable = Boolean(feature.releaseEligible && feature.flagName)");
    expect(MATRIX_SRC).toContain("disabled={!editable || busy}");
    expect(MATRIX_SRC).toContain("non ancora disponibile");
  });

  test("RM-09 la sezione Release mostra prima la tabella, poi le card", () => {
    const matrixAt = SECTION_SRC.indexOf("<ReleaseMatrix releases={initialReleases} />");
    const cardsAt = SECTION_SRC.indexOf("<ReleaseCard key={release.id} release={release} />");
    expect(matrixAt).toBeGreaterThan(-1);
    expect(cardsAt).toBeGreaterThan(matrixAt);
  });
});
