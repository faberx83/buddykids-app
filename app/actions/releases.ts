"use server";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — Promotion
// Engine.
//
// Riusa INTERAMENTE il meccanismo già in produzione per gli override
// (public.feature_flag_overrides, RLS is_platform_admin() — vedi
// app/actions/feature-flag-overrides.ts): nessuna colonna di stato nuova,
// nessuna tabella nuova. Ogni "promozione" è una insert-or-enable su una
// riga di override; ogni "kill switch" è un disable (enabled=false), MAI un
// delete — la storia (chi/quando/quale scope) resta sempre ricostruibile
// leggendo created_by/updated_by/created_at/updated_at sulle righe
// accumulate, esattamente come richiesto ("se non è ricostruibile
// correttamente senza cancellare history, modifica il promotion flow per
// preservare le righe storiche" — qui non si cancella mai una riga).
//
// Validazione pura (quali flag tocca una release, la conferma "GLOBAL")
// vive in lib/releases/promotion-validation.ts, testabile senza Supabase —
// questo file è il thin wrapper I/O sopra quella logica, stesso principio
// già seguito da lib/feature-flags/resolve.ts sopra lib/feature-flags/evaluate.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { getFlagDefinition } from "@/lib/feature-flags/registry";
import { friendlyError } from "@/lib/feature-flags/friendly-errors";
import {
  resolveReleaseFlags,
  isResolvedReleaseFlagsError,
  validateGlobalConfirmation,
  shouldSkipOverrideWrite,
} from "@/lib/releases/promotion-validation";
import { INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY } from "@/lib/releases/visibility";

// Tipo inferito direttamente da createClient() (lib/supabase/server.ts)
// invece di importare SupabaseClient da @supabase/supabase-js: evita
// qualunque disallineamento col generic/versione realmente usati lì.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ReleasePromotionResult {
  error?: string;
  affectedFlags?: string[];
}

type ScopeTarget = { scopeType: "global"; scopeValue: null } | { scopeType: "cohort"; scopeValue: string };

/**
 * Trova la riga di override per (flagName, scope) e la abilita/disabilita;
 * se non esiste ancora la crea SOLO quando enabled=true (disabilitare un
 * override mai esistito è già lo stato di fatto, nessuna riga da creare per
 * dirlo — stesso principio di batchDeactivateBetaFeaturesAction in
 * app/actions/feature-flag-overrides.ts). MAI un delete: la riga, una volta
 * creata, resta per sempre come traccia di audit (created_by/created_at =
 * quando questo scope è stato attivato per la prima volta; updated_by/
 * updated_at = ultima volta che è stato acceso/spento DAVVERO — vedi
 * shouldSkipOverrideWrite: se il valore richiesto è già quello attuale non
 * si scrive nulla, altrimenti updated_by/updated_at verrebbero ri-timbrati
 * anche quando nessun valore è davvero cambiato per QUESTA riga, es. il
 * passo "enableInternal" del kill switch quando l'override interno era
 * già enabled=true — fix 11/09/2026, verifica "audit promotion history").
 */
async function upsertScopeOverride(
  supabase: ServerSupabaseClient,
  actorId: string,
  flagName: string,
  target: ScopeTarget,
  enabled: boolean
): Promise<{ error?: string }> {
  let existingQuery = supabase
    .from("feature_flag_overrides")
    .select("id, enabled")
    .eq("flag_name", flagName)
    .eq("scope_type", target.scopeType);
  existingQuery = target.scopeValue === null ? existingQuery.is("scope_value", null) : existingQuery.eq("scope_value", target.scopeValue);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    if (shouldSkipOverrideWrite(existing.enabled, enabled)) {
      return {};
    }
    const { error } = await supabase
      .from("feature_flag_overrides")
      .update({ enabled, updated_by: actorId })
      .eq("id", existing.id);
    return { error: error ? friendlyError(error) : undefined };
  }

  if (!enabled) {
    // Nessuna riga esiste e la si vuole spenta: è già lo stato di fatto
    // (default sicuro del registry) — nessuna scrittura necessaria.
    return {};
  }

  const { error } = await supabase.from("feature_flag_overrides").insert({
    flag_name: flagName,
    scope_type: target.scopeType,
    scope_value: target.scopeValue,
    enabled: true,
    expires_at: null,
    created_by: actorId,
    updated_by: actorId,
  });
  return { error: error ? friendlyError(error) : undefined };
}

async function getAuthenticatedActor(supabase: ServerSupabaseClient): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };
  return { id: user.id };
}

function assertScopeAllowed(flagName: string, scopeType: "global" | "cohort"): string | undefined {
  const definition = getFlagDefinition(flagName);
  if (!definition || !definition.allowedScopes.includes(scopeType)) {
    return `Il flag ${flagName} non ammette lo scope "${scopeType}" — impossibile completare questa promozione.`;
  }
  return undefined;
}

/**
 * DISATTIVATO → ANTEPRIMA INTERNA. Primo gradino del lifecycle approvato
 * (DISATTIVATO → ANTEPRIMA INTERNA → PILOT → DISPONIBILE A TUTTI — fix
 * 11/09/2026, richiesta Fabrizio: prima la UI offriva "Abilita al Pilot"
 * anche da una release DISATTIVATA, saltando questo stadio). Abilita, per
 * ogni flag della release, SOLO l'override cohort:"internal-preview" — non
 * tocca in alcun modo gli override cohort:"trama-one-controlled-beta"
 * (Pilot) o "global": la release resta invisibile a Pilot/tutti finché non
 * viene esplicitamente promossa oltre con le azioni dedicate.
 */
export async function promoteReleaseToInternalPreviewAction(releaseId: string): Promise<ReleasePromotionResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const resolved = resolveReleaseFlags(releaseId);
  if (isResolvedReleaseFlagsError(resolved)) return { error: resolved.error };
  if (resolved.flagNames.length === 0) {
    return { error: "Nessuna feature con flag associato in questa release — niente da abilitare in Anteprima Interna." };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  for (const flagName of resolved.flagNames) {
    const scopeError = assertScopeAllowed(flagName, "cohort");
    if (scopeError) return { error: scopeError };
    const res = await upsertScopeOverride(
      supabase,
      actor.id,
      flagName,
      { scopeType: "cohort", scopeValue: INTERNAL_PREVIEW_COHORT_KEY },
      true
    );
    if (res.error) return { error: res.error };
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: resolved.flagNames };
}

/**
 * ANTEPRIMA INTERNA → PILOT. Abilita, per ogni flag della release,
 * un override cohort:"trama-one-controlled-beta" (la coorte Pilot — stessa
 * già in produzione per la Beta). Non tocca l'eventuale override
 * cohort:"internal-preview": resta acceso, gli account interni continuano a
 * vedere la feature (sono un sottoinsieme naturale del pubblico Pilot),
 * preservando quando è iniziata la visibilità interna.
 */
export async function promoteReleaseToPilotAction(releaseId: string): Promise<ReleasePromotionResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const resolved = resolveReleaseFlags(releaseId);
  if (isResolvedReleaseFlagsError(resolved)) return { error: resolved.error };
  if (resolved.flagNames.length === 0) {
    return { error: "Nessuna feature con flag associato in questa release — niente da promuovere a Pilot." };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  for (const flagName of resolved.flagNames) {
    const scopeError = assertScopeAllowed(flagName, "cohort");
    if (scopeError) return { error: scopeError };
    const res = await upsertScopeOverride(supabase, actor.id, flagName, { scopeType: "cohort", scopeValue: PILOT_COHORT_KEY }, true);
    if (res.error) return { error: res.error };
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: resolved.flagNames };
}

/**
 * qualunque stato → GLOBAL. Richiede la conferma testuale "GLOBAL" (stesso
 * pattern già in produzione in BatchBetaControls) — validata QUI lato
 * server, non solo lato client, perché una Server Action è raggiungibile
 * direttamente. Abilita un override scope "global" per ogni flag della
 * release; non tocca gli override cohort esistenti (internal-preview/pilot
 * restano accesi ma diventano irrilevanti in pratica: global ha la
 * precedenza più bassa nello scope, ma essendo enabled=true per chiunque,
 * "vince" comunque per chi non ha un override più specifico).
 */
export async function promoteReleaseToGlobalAction(releaseId: string, confirmText: string): Promise<ReleasePromotionResult> {
  const confirmError = validateGlobalConfirmation(confirmText);
  if (confirmError) return { error: confirmError };

  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const resolved = resolveReleaseFlags(releaseId);
  if (isResolvedReleaseFlagsError(resolved)) return { error: resolved.error };
  if (resolved.flagNames.length === 0) {
    return { error: "Nessuna feature con flag associato in questa release — niente da rendere disponibile a tutti." };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  for (const flagName of resolved.flagNames) {
    const scopeError = assertScopeAllowed(flagName, "global");
    if (scopeError) return { error: scopeError };
    const res = await upsertScopeOverride(supabase, actor.id, flagName, { scopeType: "global", scopeValue: null }, true);
    if (res.error) return { error: res.error };
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: resolved.flagNames };
}

/**
 * KILL SWITCH — GLOBAL (o PILOT) → INTERNAL. Per ogni flag della release:
 * disabilita l'override "global" (se esiste), disabilita l'override
 * cohort:"trama-one-controlled-beta" (se esiste), e si assicura che
 * l'override cohort:"internal-preview" sia acceso — così la capability
 * torna visibile SOLO alla coorte interna, mai cancellando le righe
 * disabilitate (restano come traccia di "questa release è stata resa
 * globale dal {data} al {data}").
 */
export async function demoteReleaseToInternalAction(releaseId: string): Promise<ReleasePromotionResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const resolved = resolveReleaseFlags(releaseId);
  if (isResolvedReleaseFlagsError(resolved)) return { error: resolved.error };
  if (resolved.flagNames.length === 0) {
    return { error: "Nessuna feature con flag associato in questa release — niente da riportare a solo interno." };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  for (const flagName of resolved.flagNames) {
    const cohortScopeError = assertScopeAllowed(flagName, "cohort");
    if (cohortScopeError) return { error: cohortScopeError };

    const disableGlobal = await upsertScopeOverride(supabase, actor.id, flagName, { scopeType: "global", scopeValue: null }, false);
    if (disableGlobal.error) return { error: disableGlobal.error };

    const disablePilot = await upsertScopeOverride(supabase, actor.id, flagName, { scopeType: "cohort", scopeValue: PILOT_COHORT_KEY }, false);
    if (disablePilot.error) return { error: disablePilot.error };

    const enableInternal = await upsertScopeOverride(
      supabase,
      actor.id,
      flagName,
      { scopeType: "cohort", scopeValue: INTERNAL_PREVIEW_COHORT_KEY },
      true
    );
    if (enableInternal.error) return { error: enableInternal.error };
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: resolved.flagNames };
}
