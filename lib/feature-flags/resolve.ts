import "server-only";

// TRAMA ONE — Feature flag resolver (Build Sprint 0)
//
// Server-only per costruzione (import "server-only" sopra). Unico modulo
// autorizzato a leggere feature_flag_overrides, tramite
// createServiceClient() (service_role, bypassa RLS — stesso client già in
// uso per app/internal/beta-pipeline/route.ts). Non usato da nessun Client
// Component: chiamato solo dai layout server-side app/one/layout.tsx,
// app/center/one/layout.tsx, app/admin/one/layout.tsx.
//
// Ritorna SEMPRE e SOLO un booleano — mai righe grezze di
// feature_flag_overrides o di beta_cohort_memberships raggiungono il
// chiamante (e quindi mai il client).

import { createServiceClient } from "@/lib/supabase/service";
import { evaluateFlag, FeatureFlagContext, FeatureFlagOverrideInput } from "./evaluate";
import { isKnownFlag } from "./registry";
import { getActiveCohortKeys } from "@/lib/beta-cohorts/membership";
import { logTelemetryEvent } from "@/lib/telemetry/correlation";

export interface ResolveFeatureFlagParams {
  flagName: string;
  userId?: string | null;
  role?: string | null;
  tenant?: string | null;
  correlationId?: string | null;
}

/** Ambiente corrente per lo scope "environment": riusa VERCEL_ENV se
 * presente (production/preview/development su Vercel), altrimenti
 * NODE_ENV — nessuna nuova variabile d'ambiente introdotta per questo. */
function currentEnvironment(): string | null {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || null;
}

export async function resolveFeatureFlag(params: ResolveFeatureFlagParams): Promise<boolean> {
  const { flagName, userId = null, role = null, tenant = null, correlationId = null } = params;

  // Flag sconosciuto al registry → false immediato, nessuna query DB.
  if (!isKnownFlag(flagName)) {
    return false;
  }

  try {
    const client = createServiceClient();
    if (!client) {
      // Supabase non configurato (modalità demo) → fallback sicuro, nessun
      // errore mostrato all'utente.
      logTelemetryEvent({
        event: "feature_flag_resolved",
        correlationId,
        tenant,
        role,
        detail: `${flagName}=false (supabase_not_configured)`,
      });
      return false;
    }

    const [overridesResult, cohortKeys] = await Promise.all([
      client
        .from("feature_flag_overrides")
        .select("scope_type, scope_value, enabled, expires_at")
        .eq("flag_name", flagName),
      userId ? getActiveCohortKeys(userId) : Promise.resolve<string[]>([]),
    ]);

    if (overridesResult.error) {
      logTelemetryEvent({
        event: "feature_flag_resolve_error",
        correlationId,
        tenant,
        role,
        detail: "db_error_reading_overrides",
      });
      return false;
    }

    const context: FeatureFlagContext = {
      environment: currentEnvironment(),
      userId,
      role,
      tenant,
      cohortKeys,
    };

    const overrides: FeatureFlagOverrideInput[] = (overridesResult.data ?? []).map((row) => ({
      scopeType: row.scope_type as FeatureFlagOverrideInput["scopeType"],
      scopeValue: row.scope_value,
      enabled: row.enabled,
      expiresAt: row.expires_at,
    }));

    const result = evaluateFlag(flagName, context, overrides);

    logTelemetryEvent({
      event: "feature_flag_resolved",
      correlationId,
      tenant,
      role,
      detail: `${flagName}=${result}`,
    });

    return result;
  } catch {
    // Qualunque eccezione imprevista (timeout, errore di rete, ecc.) →
    // fallback sicuro, mai propagata al chiamante.
    logTelemetryEvent({
      event: "feature_flag_resolve_error",
      correlationId,
      tenant,
      role,
      detail: "unexpected_exception",
    });
    return false;
  }
}
