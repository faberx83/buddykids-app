import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";

// TRAMA ONE Build Sprint 6 (E11, "eventi analytics con correlationId") —
// lib/telemetry/events.ts::persistProductEvent() estende
// lib/telemetry/correlation.ts::logTelemetryEvent() (Sprint 0, invariato,
// SOLO console) con una persistenza best-effort su public.product_events
// (migration_20_product_events.sql, NON applicata). KNOWN_PRODUCT_EVENTS è
// l'unica parte di questo modulo priva di I/O (una whitelist in memoria):
// testabile con test()/expect() di Playwright senza fixture `page` e senza
// bisogno di un browser reale, stesso principio già stabilito in questo
// sprint per tests/one/command-center.spec.ts (lib/command-center/priority.ts).
//
// Comando: npx playwright test tests/one/product-events.spec.ts --grep "no browser"

test.describe("Sprint 6 - Eventi prodotto: registro KNOWN_PRODUCT_EVENTS (no browser)", () => {
  test("il registro contiene tutti gli eventi già emessi dai tre layout /one", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("one_route_access");
    expect(KNOWN_PRODUCT_EVENTS).toContain("one_route_fallback");
  });

  test("il registro contiene l'evento critico DEC-48 (override scaduto silenzioso)", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("feature_flag_silent_fallback_expired_override");
  });

  test("il registro contiene i quattro eventi Walkthrough (start/complete/skip/restart)", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("walkthrough_step_started");
    expect(KNOWN_PRODUCT_EVENTS).toContain("walkthrough_step_completed");
    expect(KNOWN_PRODUCT_EVENTS).toContain("walkthrough_step_skipped");
    expect(KNOWN_PRODUCT_EVENTS).toContain("walkthrough_restarted");
  });

  test("il registro non contiene duplicati (ogni evento noto è univoco)", () => {
    const unique = new Set(KNOWN_PRODUCT_EVENTS);
    expect(unique.size).toBe(KNOWN_PRODUCT_EVENTS.length);
  });
});

// ────────────────────────────────────────────────────────────────
// TC-N612 — verifica end-to-end su deploy reale con migration_20 applicata.
// Gated (isRealDeployment): richiede un ambiente con Supabase configurato,
// migration_20_product_events.sql applicata da Fabrizio, e
// SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere product_events (RLS
// select è ristretta a is_platform_admin(), quindi una lettura di verifica
// nel test usa lo stesso client service_role già in uso in
// tests/one/email-delivery.spec.ts, NON la sessione di loginAs).
// ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  return createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe("TRAMA ONE — Eventi prodotto (Sprint 6, E11)", () => {
  test("TC-N612 - Visitare /one registra un evento product_events con correlation_id valorizzato", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e TRAMA_ONE_ENABLED attivo.");
    test.skip(
      !SUPABASE_URL || !SERVICE_ROLE_KEY,
      "Richiede SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere product_events (RLS solo Admin)."
    );

    const admin = getAdminClient();
    const before = new Date().toISOString();

    await loginAs(page, "parent");
    await page.goto("/one");

    // Retry breve: persistProductEvent() è fire-and-forget lato Server
    // Component, il commit dell'insert può richiedere qualche istante dopo
    // che la pagina ha già finito di renderizzare.
    let rows: { event_name: string; correlation_id: string | null }[] = [];
    for (let attempt = 0; attempt < 5 && rows.length === 0; attempt++) {
      const { data } = await admin
        .from("product_events")
        .select("event_name, correlation_id")
        .eq("event_name", "one_route_access")
        .gte("created_at", before)
        .order("created_at", { ascending: false })
        .limit(1);
      rows = data ?? [];
      if (rows.length === 0) await page.waitForTimeout(500);
    }

    expect(rows.length, "deve esistere almeno una riga one_route_access dopo la visita a /one").toBeGreaterThan(0);
    expect(rows[0].correlation_id, "correlation_id non deve mai essere null per un evento persistito").toBeTruthy();
  });
});
