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
import {
  evaluateFlagDetailed,
  findRecentlyExpiredMatchingOverride,
  FeatureFlagContext,
  FeatureFlagEvaluationDetail,
  FeatureFlagOverrideInput,
} from "./evaluate";
import { isKnownFlag } from "./registry";
import { getActiveCohortKeys } from "@/lib/beta-cohorts/membership";
import { logTelemetryEvent } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";

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

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026). Estratto da
// quello che prima era il corpo di resolveFeatureFlag(): STESSO identico
// comportamento (stesso ordine di operazioni, stessi eventi di telemetria,
// stesso fail-safe try/catch) — resolveFeatureFlag() sotto è ora un thin
// wrapper che scarta il dettaglio, comportamento invariato per tutti i 30+
// call site esistenti. Aggiunta SOLO per poter offrire, a chi lo chiede
// esplicitamente (resolveFeatureFlagVisibility), anche QUALE scope ha
// determinato il risultato — serve a InternalPreviewBadge, non ai call site
// esistenti (che continuano a ricevere solo un booleano).
async function resolveFeatureFlagDetail(params: ResolveFeatureFlagParams): Promise<FeatureFlagEvaluationDetail> {
  const { flagName, userId = null, role = null, tenant = null, correlationId = null } = params;

  // Flag sconosciuto al registry → false immediato, nessuna query DB.
  if (!isKnownFlag(flagName)) {
    return { enabled: false, matchedScope: null, matchedScopeValue: null };
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
      return { enabled: false, matchedScope: null, matchedScopeValue: null };
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
      return { enabled: false, matchedScope: null, matchedScopeValue: null };
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

    const now = new Date();
    const detail = evaluateFlagDetailed(flagName, context, overrides, now);

    logTelemetryEvent({
      event: "feature_flag_resolved",
      correlationId,
      tenant,
      role,
      detail: `${flagName}=${detail.enabled}`,
    });

    // TRAMA ONE Build Sprint 6 (backlog vincolante P1, "Feature flag override
    // expiry") — se il risultato è false ma esiste un override enabled=true
    // per questo esatto contesto scaduto da poco (vedi
    // findRecentlyExpiredMatchingOverride, grace window 72h), il fallback
    // potrebbe essere un incidente (scadenza dimenticata, come TC-N409) e non
    // una decisione deliberata: un evento di telemetria DISTINTO da
    // "feature_flag_resolved" rende questo caso visibile senza dover
    // scoprirlo da una suite di test rossa, come accaduto la prima volta.
    if (!detail.enabled) {
      const recentlyExpired = findRecentlyExpiredMatchingOverride(context, overrides, now);
      if (recentlyExpired) {
        // TRAMA ONE Build Sprint 6 (E11) — persistProductEvent() invece di
        // logTelemetryEvent(): questo evento specifico (DEC-48, override
        // scaduto che poteva sembrare una decisione deliberata) è
        // esattamente il caso che il task E11 doveva rendere
        // interrogabile/durevole, non solo visibile per un istante nei log
        // del processo Vercel.
        await persistProductEvent({
          event: "feature_flag_silent_fallback_expired_override",
          correlationId,
          tenant,
          role,
          detail: `${flagName}: override scope=${recentlyExpired.scopeType}:${recentlyExpired.scopeValue ?? "(global)"} scaduto il ${recentlyExpired.expiresAt} era enabled=true — verificare in /admin/feature-flags`,
        });
      }
    }

    return detail;
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
    return { enabled: false, matchedScope: null, matchedScopeValue: null };
  }
}

export async function resolveFeatureFlag(params: ResolveFeatureFlagParams): Promise<boolean> {
  const detail = await resolveFeatureFlagDetail(params);
  return detail.enabled;
}

/**
 * TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026). Come
 * resolveFeatureFlag(), ma riporta anche QUALE scope ha determinato il
 * risultato — usato per decidere se mostrare InternalPreviewBadge (deve
 * comparire solo quando una capability è visibile grazie allo scope
 * cohort:"internal-preview" specificamente, non per ogni flag risolto true).
 * Nessun call site esistente deve migrare a questa funzione: resta additiva.
 */
export async function resolveFeatureFlagVisibility(
  params: ResolveFeatureFlagParams
): Promise<FeatureFlagEvaluationDetail> {
  return resolveFeatureFlagDetail(params);
}
