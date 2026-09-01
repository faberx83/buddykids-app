import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { TRAMA_BETA_VERSION } from "@/lib/beta-version";

// TRAMA BETA v1.1 — Wave 5 della revisione (sezioni 25-26). Copre
// BETA-V-02: il badge Beta mostrato in app (NextgenBadge.tsx) deve
// derivare dall'unica source of truth centralizzata (lib/beta-version.ts),
// non da una stringa duplicata nella pagina.

test.describe("TRAMA BETA v1.1 — badge Beta in app", () => {
  // Il test importa la STESSA costante mostrata dal badge invece di
  // hardcodare "v1.1": se la versione cambia in futuro (unica modifica in
  // lib/beta-version.ts), questo test resta corretto senza essere toccato
  // — verifica quindi davvero che il badge derivi dalla source of truth
  // centralizzata, non da una stringa duplicata nella pagina.
  test("BETA-V-02 - il badge Beta mostrato in app riflette TRAMA_BETA_VERSION (nessuna stringa duplicata)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(`Beta · ${TRAMA_BETA_VERSION}`, { exact: true })).toBeVisible();
  });
});
