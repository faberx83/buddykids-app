import { test, expect } from "@playwright/test";
import { TRAMA_BETA_VERSION } from "@/lib/beta-version";

// TRAMA BETA v1.1 — Wave 5 della revisione (sezioni 25-26): centralizzare
// la versione Beta in un'unica source of truth. Copre BETA-V-01.
//
// A differenza degli altri file in tests/nextgen/*.spec.ts, questo test
// NON usa `page`/`loginAs`/`isRealDeployment`: TRAMA_BETA_VERSION è
// un'importazione pura di una costante (nessuna chiamata Supabase, nessun
// DOM) — stesso pattern "solo logica" di planner-week-status.spec.ts. Gira
// in qualunque ambiente, compreso questo sandbox, senza deploy reale.

test.describe("TRAMA BETA v1.1 — lib/beta-version.ts (regressione pura)", () => {
  test("BETA-V-01 - TRAMA_BETA_VERSION è l'unica costante e ha un formato valido ('v<major>.<minor>')", () => {
    expect(typeof TRAMA_BETA_VERSION).toBe("string");
    expect(TRAMA_BETA_VERSION.length).toBeGreaterThan(0);
    expect(TRAMA_BETA_VERSION).toMatch(/^v\d+\.\d+$/);
  });
});
