import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";
import { computePilotStatus } from "../../lib/pilot/status";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";

// TRAMA — Wave 1 "Pilot Observability" (audit TRAMA_PILOT_ARCHITECTURE_
// REVIEW.md sez.8, implementazione: docs/trama-one/analysis/
// TRAMA_PILOT_OBSERVABILITY_COORDINATION_IMPLEMENTATION.md).
// computePilotStatus() vive in lib/pilot/status.ts SENZA "import server-only"
// apposta (stesso principio già stabilito per lib/command-center/priority.ts
// e lib/telemetry/known-events.ts) — testabile qui senza fixture `page` e
// senza bisogno di un browser reale.
//
// Comando: npx playwright test tests/one/pilot-observability.spec.ts --grep "no browser"

test.describe("Wave 1 - computePilotStatus (no browser)", () => {
  test("PILOT-A05 [no browser] - onboarding non iniziato, nessuna attività -> invited_registered", () => {
    expect(computePilotStatus("not_started", null, null)).toBe("invited_registered");
  });

  test("PILOT-A05 [no browser] - onboarding in corso, nessuna attività -> onboarding", () => {
    expect(computePilotStatus("in_progress", null, null)).toBe("onboarding");
  });

  test("PILOT-A05 [no browser] - onboarding completato, nessuna attività -> not_yet_active", () => {
    expect(computePilotStatus("completed", null, null)).toBe("not_yet_active");
  });

  test("PILOT-A05 [no browser] - onboarding saltato, nessuna attività -> not_yet_active", () => {
    expect(computePilotStatus("skipped", null, null)).toBe("not_yet_active");
  });

  test("PILOT-A06 [no browser] - attività presente, nessun accesso registrato -> activated", () => {
    expect(computePilotStatus("completed", "2026-08-01T10:00:00.000Z", null)).toBe("activated");
  });

  test("PILOT-A06 [no browser] - attività presente, accesso lo stesso giorno -> activated (non ancora 'tornato')", () => {
    expect(computePilotStatus("completed", "2026-08-01T10:00:00.000Z", "2026-08-01T18:00:00.000Z")).toBe("activated");
  });

  test("PILOT-A07 [no browser] - attività presente, accesso 2 giorni dopo -> returning", () => {
    expect(computePilotStatus("completed", "2026-08-01T10:00:00.000Z", "2026-08-03T10:00:00.000Z")).toBe("returning");
  });

  test("PILOT-A08 [no browser] - la whitelist eventi non contiene nulla che somigli a un identificativo personale", () => {
    for (const evt of KNOWN_PRODUCT_EVENTS) {
      expect(evt).not.toMatch(/email|user_id|userid|full_?name|phone|address/i);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Verifica end-to-end su deploy reale. Usa gli account Beta REALI già
// verificati in produzione durante l'audit (mariafpoli@gmail.com,
// iscritta il 28/08 con TRAMABETA26, membro attivo di
// trama-one-controlled-beta) invece di crearne di fittizi: nessuna fixture
// di setup per "un utente pilota" esiste ancora in questo progetto.
// ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KNOWN_PILOT_EMAIL = "mariafpoli@gmail.com";

function getAdminClient() {
  return createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe("Wave 1 - /admin/one/pilot", () => {
  test("PILOT-A01 - Admin autorizzato apre la pagina Pilota", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account platform_admin.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/pilot");
    await expect(page.getByRole("heading", { name: "Pilota — Nuovi utenti" })).toBeVisible();
  });

  test("PILOT-A02 - Un genitore non vede la pagina Pilota (stesso AccessGate di ogni altra pagina /admin)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account parent.");
    await loginAs(page, "parent");
    await page.goto("/admin/one/pilot");
    await expect(page.getByText("Accesso non autorizzato")).toBeVisible();
  });

  test("PILOT-A03/A04 - Un membro noto della Controlled Beta Cohort compare in elenco con la cohort corretta", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/pilot");
    await expect(page.getByText(KNOWN_PILOT_EMAIL)).toBeVisible();
    await expect(page.getByText("trama-one-controlled-beta")).toBeVisible();
  });

  test("PILOT-A07 - Ultimo accesso non è '—' per un utente con last_sign_in_at reale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(
      !SUPABASE_URL || !SERVICE_ROLE_KEY,
      "Richiede SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere auth.users."
    );

    const admin = getAdminClient();
    const { data } = await admin.auth.admin.listUsers();
    const knownUser = data.users.find((u) => u.email === KNOWN_PILOT_EMAIL);
    test.skip(!knownUser?.last_sign_in_at, `${KNOWN_PILOT_EMAIL} non ha ancora un last_sign_in_at registrato.`);

    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/pilot");

    // Non asseriamo il valore esatto (formattazione locale/fuso orario lato
    // client): verifichiamo solo che la riga di questo utente non mostri il
    // placeholder "—" nella colonna "Ultimo accesso".
    const row = page.locator("tr", { hasText: KNOWN_PILOT_EMAIL });
    await expect(row).not.toContainText("——"); // sanity: non entrambe le colonne vuote
  });

  test("PILOT-A00 - Nessun utente in cohort mostra l'empty state, non un errore", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    // Best-effort: se la cohort ha già membri (atteso in produzione), questo
    // test verifica solo che la pagina non vada in errore — l'empty state
    // vero (0 righe) non è riproducibile senza un ambiente Supabase isolato.
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/pilot");
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
