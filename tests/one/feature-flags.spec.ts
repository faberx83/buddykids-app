import { test, expect } from "@playwright/test";
import { evaluateFlag } from "../../lib/feature-flags/evaluate";

// TRAMA ONE — unit test puri per lib/feature-flags/evaluate.ts (Build Sprint 0).
//
// NESSUN "page" fixture, NESSUN browser: questi test importano ed eseguono
// direttamente la funzione pura evaluateFlag() con override/context in
// memoria — eseguibili in qualunque ambiente Node, incluso il sandbox
// Claude che non può lanciare un browser reale (mancano le librerie di
// sistema, nessun accesso root per installarle — limite già documentato
// nella baseline pre-TRAMA ONE).
//
// Comando: npx playwright test tests/one/feature-flags.spec.ts

test.describe("TRAMA ONE — feature flag evaluate() [no browser]", () => {
  test("flag sconosciuto al registry -> false, indipendentemente dagli override", () => {
    const result = evaluateFlag(
      "FLAG_INESISTENTE",
      { environment: "production" },
      [{ scopeType: "global", scopeValue: null, enabled: true, expiresAt: null }]
    );
    expect(result).toBe(false);
  });

  test("nessun override -> default del registry (false per TRAMA_ONE_ENABLED)", () => {
    const result = evaluateFlag("TRAMA_ONE_ENABLED", { environment: "production" }, []);
    expect(result).toBe(false);
  });

  test("override globale enabled=true si applica in assenza di override più specifici", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [{ scopeType: "global", scopeValue: null, enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("precedenza: override utente vince su override globale opposto", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { userId: "user-123", environment: "production" },
      [
        { scopeType: "global", scopeValue: null, enabled: true, expiresAt: null },
        { scopeType: "user", scopeValue: "user-123", enabled: false, expiresAt: null },
      ]
    );
    expect(result).toBe(false);
  });

  test("precedenza: ruolo vince su coorte, coorte vince su tenant", () => {
    const context = {
      userId: "user-999", // nessun override per questo utente
      role: "center_admin",
      tenant: "partner",
      cohortKeys: ["beta-wave-1"],
    };
    const result = evaluateFlag("TRAMA_ONE_ENABLED", context, [
      { scopeType: "tenant", scopeValue: "partner", enabled: false, expiresAt: null },
      { scopeType: "cohort", scopeValue: "beta-wave-1", enabled: true, expiresAt: null },
      { scopeType: "role", scopeValue: "center_admin", enabled: false, expiresAt: null },
    ]);
    // role (false) ha precedenza su cohort (true) e tenant (false)
    expect(result).toBe(false);
  });

  test("override scaduto viene ignorato, si applica il default", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [
        {
          scopeType: "global",
          scopeValue: null,
          enabled: true,
          expiresAt: "2020-01-01T00:00:00.000Z", // nel passato rispetto a "now" di default
        },
      ]
    );
    expect(result).toBe(false);
  });

  test("data di scadenza non valida -> override trattato come scaduto (fallback sicuro)", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [{ scopeType: "global", scopeValue: null, enabled: true, expiresAt: "non-una-data" }]
    );
    expect(result).toBe(false);
  });

  test("override con scope_value nullo su uno scope non-globale non matcha mai", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { userId: "user-1" },
      [{ scopeType: "user", scopeValue: null as unknown as string, enabled: true, expiresAt: null }]
    );
    expect(result).toBe(false);
  });

  test("now esplicito: override con scadenza futura rispetto a 'now' resta valido", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [
        {
          scopeType: "global",
          scopeValue: null,
          enabled: true,
          expiresAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      now
    );
    expect(result).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// TRAMA ONE Build Sprint 0 — Pre-Migration Hardening, punto 5:
// normalizzazione scope_value coerente tra inserimento/query/evaluate.ts/
// unique index. Environment/role/tenant/cohort vanno confrontati con
// lower(trim()); "user" MAI normalizzato (UUID, confronto esatto).
// ────────────────────────────────────────────────────────────────
test.describe("TRAMA ONE — normalizzazione scope_value [no browser]", () => {
  test("environment: maiuscole/minuscole non contano ('Production' matcha 'production')", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [{ scopeType: "environment", scopeValue: "Production", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("role: spazi ai bordi non contano (' center_admin ' matcha 'center_admin')", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { role: "center_admin" },
      [{ scopeType: "role", scopeValue: " center_admin ", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("tenant: maiuscole/minuscole e spazi combinati non contano (' PARTNER' matcha 'partner')", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { tenant: "partner" },
      [{ scopeType: "tenant", scopeValue: " PARTNER", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("cohort: normalizzazione applicata sia allo scope_value sia alle cohortKeys del context", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { cohortKeys: [" Beta-Wave-1 "] },
      [{ scopeType: "cohort", scopeValue: "beta-wave-1", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("user: NESSUNA normalizzazione — un UUID con maiuscole diverse NON matcha (confronto esatto)", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { userId: "abc-123" },
      [{ scopeType: "user", scopeValue: "ABC-123", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(false);
  });

  test("user: stesso valore esatto matcha correttamente", () => {
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { userId: "abc-123" },
      [{ scopeType: "user", scopeValue: "abc-123", enabled: true, expiresAt: null }]
    );
    expect(result).toBe(true);
  });

  test("scope duplicati normalizzati (difensivo): con due override che normalizzano allo stesso scope, vince il primo nell'ordine dell'array (contratto deterministico di Array.find, mai atteso in pratica grazie all'unique index DB)", () => {
    const resultFirstWins = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [
        { scopeType: "environment", scopeValue: "Production", enabled: true, expiresAt: null },
        { scopeType: "environment", scopeValue: " production ", enabled: false, expiresAt: null },
      ]
    );
    expect(resultFirstWins).toBe(true);

    const resultOrderSwapped = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { environment: "production" },
      [
        { scopeType: "environment", scopeValue: " production ", enabled: false, expiresAt: null },
        { scopeType: "environment", scopeValue: "Production", enabled: true, expiresAt: null },
      ]
    );
    expect(resultOrderSwapped).toBe(false);
  });

  test("precedenza invariata dalla normalizzazione: 'User' (case diversa, ignorata per scope user) non deve mai vincere su un override role valido", () => {
    // Lo scope_value 'user' con case diversa dallo userId reale NON matcha
    // affatto (confronto esatto) quindi non entra tra gli "applicable":
    // la precedenza resta role > cohort > tenant > environment > global,
    // invariata.
    const result = evaluateFlag(
      "TRAMA_ONE_ENABLED",
      { userId: "user-1", role: "parent" },
      [
        { scopeType: "user", scopeValue: "USER-1", enabled: true, expiresAt: null }, // non matcha (case)
        { scopeType: "role", scopeValue: "PARENT", enabled: false, expiresAt: null }, // matcha (normalizzato)
      ]
    );
    expect(result).toBe(false);
  });
});
