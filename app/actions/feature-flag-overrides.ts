"use server";

// TRAMA ONE Build Sprint 6 (backlog vincolante P1, "Feature flag override
// expiry") — CRUD Admin per public.feature_flag_overrides. Prima di queste
// azioni l'unico modo di creare/modificare un override era una query SQL
// manuale (SPRINT_0_ACTIVATION_RUNBOOK.md), senza alcuna validazione
// applicativa (scope_type ammesso per il flag, coerenza scope_value/
// scope_type) — solo il vincolo CHECK a livello DB.
//
// RLS (migration_07_feature_flags_foundation.sql) impone già
// is_platform_admin() su insert/update/delete: qui usiamo il client
// autenticato ordinario (mai il service client), stesso principio di
// app/actions/admin.ts — se chi chiama non è Admin, Postgres rifiuta la
// scrittura e restituiamo un messaggio leggibile invece del codice errore
// grezzo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { isKnownFlag, getFlagDefinition } from "@/lib/feature-flags/registry";
import { getBetaEnabledFlagNames } from "@/lib/feature-registry/catalog";

function friendlyError(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501" || error.message.includes("policy")) {
    return "Non hai i permessi di Admin piattaforma per gestire i feature flag.";
  }
  if (error.message.includes("feature_flag_scope_value_consistency")) {
    return "Scope 'global' non ammette un valore; ogni altro scope richiede un valore non vuoto.";
  }
  if (error.message.includes("idx_feature_flag_overrides_unique")) {
    return "Esiste già un override per questo flag+scope+valore — modifica quello esistente invece di crearne uno nuovo.";
  }
  return error.message;
}

export interface CreateFeatureFlagOverrideInput {
  flagName: string;
  scopeType: string;
  scopeValue: string | null;
  enabled: boolean;
  /** ISO 8601 oppure null = nessuna scadenza. */
  expiresAt: string | null;
}

export async function createFeatureFlagOverrideAction(
  input: CreateFeatureFlagOverrideInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownFlag(input.flagName)) return { error: "Flag sconosciuto al registry (lib/feature-flags/registry.ts)" };

  const definition = getFlagDefinition(input.flagName)!;
  if (!definition.allowedScopes.includes(input.scopeType as (typeof definition.allowedScopes)[number])) {
    return { error: `Scope "${input.scopeType}" non ammesso per ${input.flagName} (ammessi: ${definition.allowedScopes.join(", ")})` };
  }
  if (input.scopeType === "global" && input.scopeValue) {
    return { error: "Lo scope 'global' non ammette un valore" };
  }
  if (input.scopeType !== "global" && !input.scopeValue?.trim()) {
    return { error: "Questo scope richiede un valore (utente/ruolo/tenant/coorte/ambiente)" };
  }
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    return { error: "Data di scadenza non valida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("feature_flag_overrides").insert({
    flag_name: input.flagName,
    scope_type: input.scopeType,
    scope_value: input.scopeType === "global" ? null : input.scopeValue!.trim(),
    enabled: input.enabled,
    expires_at: input.expiresAt,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/feature-flags");
  return {};
}

export interface UpdateFeatureFlagOverrideInput {
  id: string;
  enabled: boolean;
  /** ISO 8601 oppure null = nessuna scadenza. */
  expiresAt: string | null;
}

export async function updateFeatureFlagOverrideAction(
  input: UpdateFeatureFlagOverrideInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    return { error: "Data di scadenza non valida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("feature_flag_overrides")
    .update({ enabled: input.enabled, expires_at: input.expiresAt, updated_by: user.id })
    .eq("id", input.id);

  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/feature-flags");
  return {};
}

// Scorciatoia mirata proprio al bug TC-N409: "riattiva per altre N ore"
// invece di dover ricompilare a mano una data ISO — riduce il rischio di
// errore manuale che ha causato la scadenza dimenticata la prima volta.
export async function extendFeatureFlagOverrideAction(id: string, hours: number): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!Number.isFinite(hours) || hours <= 0) return { error: "Numero di ore non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const newExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("feature_flag_overrides")
    .update({ expires_at: newExpiresAt, updated_by: user.id })
    .eq("id", id);

  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/feature-flags");
  return {};
}

export async function deleteFeatureFlagOverrideAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const { error } = await supabase.from("feature_flag_overrides").delete().eq("id", id);

  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/feature-flags");
  return {};
}

// TRAMA ONE — Addendum Sezione B (Feature Control Center): "batch attiva
// tutte le funzionalità Beta pronte" / "disattiva tutte le funzionalità
// Beta" con rollback esatto. Deliberatamente NON un secondo motore di
// flag: opera sugli stessi override di feature_flag_overrides sopra,
// scoperti dinamicamente da getBetaEnabledFlagNames() (Sezione 5,
// lib/feature-registry/catalog.ts) invece di un elenco scritto a mano —
// oggi risolve a un solo flag (TRAMA_ONE_ENABLED) perché è l'unico che
// governa voci BETA_ENABLED, ma resta corretto se in futuro una seconda
// funzionalità Beta userà un flag diverso, senza toccare questo file.
export interface BatchBetaScopeInput {
  scopeType: string;
  scopeValue: string | null;
}

function validateBatchScope(input: BatchBetaScopeInput): string | undefined {
  if (input.scopeType === "global" && input.scopeValue) {
    return "Lo scope 'global' non ammette un valore";
  }
  if (input.scopeType !== "global" && !input.scopeValue?.trim()) {
    return "Questo scope richiede un valore (utente/ruolo/tenant/coorte/ambiente)";
  }
  return undefined;
}

export async function batchActivateBetaFeaturesAction(
  input: BatchBetaScopeInput
): Promise<{ error?: string; affectedFlags?: string[] }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const flagNames = getBetaEnabledFlagNames();
  if (flagNames.length === 0) {
    return { error: "Nessuna funzionalità in stato BETA_ENABLED nel catalogo — niente da attivare." };
  }
  const scopeError = validateBatchScope(input);
  if (scopeError) return { error: scopeError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const scopeValue = input.scopeType === "global" ? null : input.scopeValue!.trim();

  for (const flagName of flagNames) {
    const definition = getFlagDefinition(flagName);
    if (!definition || !definition.allowedScopes.includes(input.scopeType as (typeof definition.allowedScopes)[number])) {
      return { error: `Scope "${input.scopeType}" non ammesso per ${flagName} (ammessi: ${definition?.allowedScopes.join(", ") ?? "—"})` };
    }

    // Upsert manuale (non tramite ON CONFLICT SQL): un override esistente
    // per lo stesso flag+scope+valore viene riattivato invece di duplicato
    // (rispetta idx_feature_flag_overrides_unique), un override assente
    // viene creato ex novo.
    let existingQuery = supabase
      .from("feature_flag_overrides")
      .select("id")
      .eq("flag_name", flagName)
      .eq("scope_type", input.scopeType);
    existingQuery = scopeValue === null ? existingQuery.is("scope_value", null) : existingQuery.eq("scope_value", scopeValue);
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("feature_flag_overrides")
        .update({ enabled: true, updated_by: user.id })
        .eq("id", existing.id);
      if (error) return { error: friendlyError(error) };
    } else {
      const { error } = await supabase.from("feature_flag_overrides").insert({
        flag_name: flagName,
        scope_type: input.scopeType,
        scope_value: scopeValue,
        enabled: true,
        expires_at: null,
        created_by: user.id,
        updated_by: user.id,
      });
      if (error) return { error: friendlyError(error) };
    }
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: flagNames };
}

// Rollback esatto di batchActivateBetaFeaturesAction: stesso scope, stessi
// flag, enabled:false invece di true. Se non esiste un override per un dato
// flag+scope (perché non è mai stato attivato lì), non fa nulla per quel
// flag: è già "off" per costruzione (default sicuro del registry), non un
// errore da segnalare.
export async function batchDeactivateBetaFeaturesAction(
  input: BatchBetaScopeInput
): Promise<{ error?: string; affectedFlags?: string[] }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const flagNames = getBetaEnabledFlagNames();
  if (flagNames.length === 0) {
    return { error: "Nessuna funzionalità in stato BETA_ENABLED nel catalogo — niente da disattivare." };
  }
  const scopeError = validateBatchScope(input);
  if (scopeError) return { error: scopeError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const scopeValue = input.scopeType === "global" ? null : input.scopeValue!.trim();

  for (const flagName of flagNames) {
    let query = supabase
      .from("feature_flag_overrides")
      .select("id")
      .eq("flag_name", flagName)
      .eq("scope_type", input.scopeType);
    query = scopeValue === null ? query.is("scope_value", null) : query.eq("scope_value", scopeValue);
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("feature_flag_overrides")
        .update({ enabled: false, updated_by: user.id })
        .eq("id", existing.id);
      if (error) return { error: friendlyError(error) };
    }
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: flagNames };
}
