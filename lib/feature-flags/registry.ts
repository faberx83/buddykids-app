// TRAMA ONE — Feature Flag Registry (Build Sprint 0)
//
// Registry versionato nel codice (Alternativa A del disegno approvato in
// docs/trama-one/analysis/TRAMA_ONE_Impact_Assessment_v1.0.md §6): solo le
// DEFINIZIONI dei flag vivono qui; gli override runtime (per ambiente,
// utente, ruolo, tenant, coorte, con scadenza opzionale) sono persistiti in
// Supabase nella tabella feature_flag_overrides (vedi
// supabase/migration_07_feature_flags_foundation.sql) e letti solo da
// lib/feature-flags/resolve.ts (server-only).
//
// Un flag NON presente in questo registry viene sempre risolto a `false`
// (comportamento sicuro di default) da lib/feature-flags/evaluate.ts,
// indipendentemente da eventuali righe orfane in tabella.

export type FeatureFlagScope =
  | "global"
  | "environment"
  | "user"
  | "role"
  | "tenant"
  | "cohort";

export interface FeatureFlagDefinition {
  /** Deve coincidere con la chiave dell'oggetto FEATURE_FLAG_REGISTRY. */
  name: string;
  description: string;
  /** Comportamento se nessun override applicabile viene trovato. */
  defaultValue: boolean;
  /** Scope ammessi per gli override di questo flag. */
  allowedScopes: FeatureFlagScope[];
}

export const FEATURE_FLAG_REGISTRY = {
  TRAMA_ONE_ENABLED: {
    name: "TRAMA_ONE_ENABLED",
    description:
      "Abilita le route /one (TRAMA ONE Build Sprint 0 — foundation) per Parent, Partner e Admin. " +
      "Default sicuro: disattivato. Mai esposto come variabile NEXT_PUBLIC_: risolto esclusivamente " +
      "server-side da lib/feature-flags/resolve.ts nei layout app/one/layout.tsx, " +
      "app/center/one/layout.tsx, app/admin/one/layout.tsx.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "tenant", "cohort"],
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type KnownFeatureFlagName = keyof typeof FEATURE_FLAG_REGISTRY;

export function isKnownFlag(name: string): name is KnownFeatureFlagName {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_REGISTRY, name);
}

export function getFlagDefinition(name: string): FeatureFlagDefinition | undefined {
  return isKnownFlag(name) ? FEATURE_FLAG_REGISTRY[name] : undefined;
}
