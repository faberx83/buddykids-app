// TRAMA ONE — Feature Flag pure evaluation logic (Build Sprint 0)
//
// Nessun I/O qui dentro (nessuna chiamata Supabase, nessuna lettura cookie):
// solo logica pura, testabile senza database e senza browser — vedi
// tests/one/feature-flags.spec.ts. L'unico modulo che fa I/O è
// lib/feature-flags/resolve.ts (server-only), che chiama evaluateFlag() dopo
// aver letto override e membership di coorte.

import { FEATURE_FLAG_REGISTRY, FeatureFlagScope, isKnownFlag } from "./registry";

export interface FeatureFlagContext {
  environment?: string | null;
  userId?: string | null;
  role?: string | null;
  tenant?: string | null;
  /** Chiavi coorte attive e non scadute per l'utente corrente (già filtrate a monte). */
  cohortKeys?: string[];
}

export interface FeatureFlagOverrideInput {
  scopeType: FeatureFlagScope;
  scopeValue: string | null;
  enabled: boolean;
  /** ISO 8601 string oppure null = nessuna scadenza. */
  expiresAt: string | null;
}

// Precedenza esplicita richiesta dal disegno approvato: utente > ruolo >
// coorte > tenant > ambiente > globale.
const SCOPE_PRECEDENCE: FeatureFlagScope[] = [
  "user",
  "role",
  "cohort",
  "tenant",
  "environment",
  "global",
];

function isExpired(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  // Data non valida = trattata come scaduta (fallback sicuro, l'override
  // viene ignorato invece di essere applicato con una scadenza ambigua).
  if (Number.isNaN(parsed)) return true;
  return parsed <= now.getTime();
}

// Normalizzazione deterministica per gli scope environment/role/tenant/cohort
// — coerente con l'unique index parziale di
// supabase/migration_07_feature_flags_foundation.sql
// (idx_feature_flag_overrides_unique_scoped, lower(trim(scope_value))): due
// valori che differiscono solo per maiuscole/minuscole o spazi ai bordi
// vengono trattati come lo stesso scope sia in fase di unicità (DB) sia in
// fase di confronto (qui). MAI applicata allo scope "user": un userId è un
// UUID e non va alterato semanticamente (Fabrizio, Pre-Migration Hardening
// punto 5) — per "user" si usa sempre uguaglianza esatta, vedi
// scopeMatchesContext sotto.
function normalizeScopeValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.trim().toLowerCase();
}

function scopeMatchesContext(
  scopeType: FeatureFlagScope,
  scopeValue: string | null,
  context: FeatureFlagContext
): boolean {
  switch (scopeType) {
    case "global":
      return true;
    case "environment":
      return scopeValue != null && normalizeScopeValue(scopeValue) === normalizeScopeValue(context.environment);
    case "user":
      // Confronto ESATTO, mai normalizzato: scopeValue è un UUID.
      return scopeValue != null && scopeValue === context.userId;
    case "role":
      return scopeValue != null && normalizeScopeValue(scopeValue) === normalizeScopeValue(context.role);
    case "tenant":
      return scopeValue != null && normalizeScopeValue(scopeValue) === normalizeScopeValue(context.tenant);
    case "cohort":
      return (
        scopeValue != null &&
        (context.cohortKeys ?? []).some((key) => normalizeScopeValue(key) === normalizeScopeValue(scopeValue))
      );
    default:
      return false;
  }
}

/**
 * Risolve un flag in modo puro a partire da un elenco di override già letti
 * dal chiamante (resolve.ts). Comportamento sempre sicuro: flag sconosciuto,
 * input malformato, o nessun override applicabile → mai un'eccezione, mai un
 * comportamento diverso da booleano.
 */
export function evaluateFlag(
  flagName: string,
  context: FeatureFlagContext,
  overrides: FeatureFlagOverrideInput[],
  now: Date = new Date()
): boolean {
  if (!isKnownFlag(flagName)) {
    // Flag sconosciuto al registry → default sicuro, indipendentemente da
    // eventuali righe presenti in tabella per quel nome (possono esistere
    // solo per errore/bypass della validazione applicativa in scrittura).
    return false;
  }

  const definition = FEATURE_FLAG_REGISTRY[flagName];

  const applicable = (overrides ?? []).filter(
    (o) => !isExpired(o.expiresAt, now) && scopeMatchesContext(o.scopeType, o.scopeValue, context)
  );

  for (const scope of SCOPE_PRECEDENCE) {
    const match = applicable.find((o) => o.scopeType === scope);
    if (match) return match.enabled;
  }

  return definition.defaultValue;
}
