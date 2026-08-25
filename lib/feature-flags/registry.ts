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
  // PRE-MICRO-PILOT CLOSURE GATE (task #566, 25/08/2026) — Legal Gate per
  // Termini/Privacy Notice/dichiarazione genitoriale su migration_27 v2
  // (LIVE in produzione, applicata da Fabrizio il 25/08/2026). Questo flag
  // NON deve MAI essere abilitato globalmente prima che il testo legale
  // reale (Termini, Privacy Notice) sia stato scritto/validato e i relativi
  // legal_documents siano PUBLISHED (published_at valorizzato) — vedi
  // docs/trama-one/analysis/PRIVACY_TERMS_TECHNICAL_DESIGN.md. Con
  // defaultValue=false e nessun override "global" mai scritto da questo
  // programma, resolveFeatureFlag() restituisce sempre false in produzione
  // finché Fabrizio non crea esplicitamente un override "user"/"cohort" per
  // un account di test/coorte interna in feature_flag_overrides. Scope
  // "environment" incluso solo per poter testare in preview; "global" incluso
  // nel registry (necessario per poterlo attivare in futuro) ma NON deve
  // essere scritto come override abilitato finché il contenuto legale non è
  // pronto — è una decisione operativa di Fabrizio, non tecnica.
  LEGAL_TERMS_GATE: {
    name: "LEGAL_TERMS_GATE",
    description:
      "Abilita il flusso di accettazione Termini/Privacy Notice/Marketing in fase di " +
      "registrazione (checkbox in LoginForm.tsx) e la richiesta di dichiarazione " +
      "genitoriale alla creazione di un bambino. Default sicuro: disattivato. " +
      "PENDING EXTERNAL REVIEW sul testo legale: non abilitare globalmente finché " +
      "legal_documents non contiene almeno una riga PUBLISHED reale per 'terms' e " +
      "'privacy_notice'. Attivabile oggi solo per singoli account di test tramite " +
      "override scope=\"user\" o scope=\"cohort\" in feature_flag_overrides.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type KnownFeatureFlagName = keyof typeof FEATURE_FLAG_REGISTRY;

export function isKnownFlag(name: string): name is KnownFeatureFlagName {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_REGISTRY, name);
}

export function getFlagDefinition(name: string): FeatureFlagDefinition | undefined {
  return isKnownFlag(name) ? FEATURE_FLAG_REGISTRY[name] : undefined;
}
