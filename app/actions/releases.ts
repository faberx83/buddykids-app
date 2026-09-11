"use server";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — Promotion
// Engine.
//
// TRAMA — RELEASE CONTROL HARDENING (11/09/2026, richiesta Fabrizio dopo
// l'uso reale su Calendar Export). Due cambi strutturali rispetto alla
// versione precedente di questo file:
//
// 1) ELIGIBILITY GATE: PRIMA di scrivere qualunque override, ogni azione
//    verifica isFlagReleaseEligible(flagName) (lib/releases/
//    promotion-validation.ts, legge FeatureCatalogEntry.releaseEligible).
//    Un flag placeholder/incompleto non riceve MAI un override tramite
//    un'azione di release — a NESSUN livello, nemmeno Anteprima Interna
//    (preferenza esplicita di Fabrizio). Motivazione originale: la release
//    "TRAMA — Planner Intelligence" contiene sia calendar_export
//    (implementata) sia school_calendar_intelligence/external_planner_items
//    (placeholder) — un'azione "Abilita al Pilot" non deve MAI creare in
//    anticipo un override per una feature il cui codice non esiste ancora,
//    perché quando quel codice verrà davvero deployato diventerebbe
//    visibile automaticamente, senza una nuova decisione esplicita.
//
// 2) GRANULARITÀ PER-FEATURE: le 4 azioni precedenti (promoteReleaseTo*/
//    demoteReleaseToInternal, tutte "a intera release", toccavano TUTTI i
//    flag della release in un solo lockstep) sono sostituite da
//    setFeatureVisibilityAction (UNA feature alla volta — §A3: "voglio
//    poter controllare una singola feature senza dover necessariamente
//    promuovere l'intero bundle") + promoteAllEligibleReleaseFeaturesAction
//    (bulk di comodo, SOLO sulle feature eligible, SOLO in avanti, mai una
//    retrocessione — vedi commento sopra
//    computeScopeOverrideTargetsForVisibility).
//
// Meccanismo di scrittura invariato: riusa INTERAMENTE
// public.feature_flag_overrides (RLS is_platform_admin()), nessuna colonna
// di stato nuova, nessuna tabella nuova, MAI un delete — stesso principio
// upsertScopeOverride/shouldSkipOverrideWrite già in produzione.

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
  isFlagReleaseEligible,
  computeScopeOverrideTargetsForVisibility,
  ScopeOverrideTarget,
} from "@/lib/releases/promotion-validation";
import { SimpleFlagVisibility } from "@/lib/releases/visibility";

// Tipo inferito direttamente da createClient() (lib/supabase/server.ts)
// invece di importare SupabaseClient da @supabase/supabase-js: evita
// qualunque disallineamento col generic/versione realmente usati lì.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ReleasePromotionResult {
  error?: string;
  affectedFlags?: string[];
}

/**
 * Trova la riga di override per (flagName, scope) e la abilita/disabilita;
 * se non esiste ancora la crea SOLO quando enabled=true (disabilitare un
 * override mai esistito è già lo stato di fatto, nessuna riga da creare per
 * dirlo). MAI un delete: la riga, una volta creata, resta per sempre come
 * traccia di audit (created_by/created_at = quando questo scope è stato
 * attivato per la prima volta; updated_by/updated_at = ultima volta che è
 * stato acceso/spento DAVVERO — vedi shouldSkipOverrideWrite: se il valore
 * richiesto è già quello attuale non si scrive nulla).
 */
async function upsertScopeOverride(
  supabase: ServerSupabaseClient,
  actorId: string,
  flagName: string,
  target: { scopeType: "global" | "cohort"; scopeValue: string | null },
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

/** Applica una lista di ScopeOverrideTarget a un flag, in ordine. Si ferma al primo errore. */
async function applyScopeTargets(
  supabase: ServerSupabaseClient,
  actorId: string,
  flagName: string,
  targets: ScopeOverrideTarget[]
): Promise<{ error?: string }> {
  for (const t of targets) {
    const scopeError = assertScopeAllowed(flagName, t.scopeType);
    if (scopeError) return { error: scopeError };
    const res = await upsertScopeOverride(supabase, actorId, flagName, { scopeType: t.scopeType, scopeValue: t.scopeValue }, t.enabled);
    if (res.error) return { error: res.error };
  }
  return {};
}

/**
 * TRAMA — RELEASE CONTROL HARDENING (11/09/2026, §A2/§A3). Azione UNICA per
 * ogni bottone della scaletta reversibile (Abilita anteprima interna /
 * Estendi al Pilot / Pubblica a tutti / Riporta al Pilot / Riporta a
 * Anteprima interna / Disattiva) — UNA feature alla volta, MAI un intero
 * bundle di release. `flagName` è verificato contro isFlagReleaseEligible
 * PRIMA di qualunque scrittura: una feature placeholder/incompleta non ha
 * pulsanti nella UI (vedi ReleaseAdminSection.tsx), ma questa Server Action
 * ri-verifica comunque da sé (è raggiungibile direttamente, stesso principio
 * CAPABILITY_ISOLATION_STANDARD.md §3) — mai fidarsi solo del fatto che la
 * pagina Admin non abbia mostrato il bottone.
 *
 * Applica TUTTE e 3 le operazioni di computeScopeOverrideTargetsForVisibility
 * (incluse eventuali disattivazioni) perché è un'azione ESPLICITA, a un
 * click deliberato di Fabrizio — può retrocedere una feature, questo è
 * esattamente lo scopo dei bottoni "Riporta a.../Disattiva".
 */
export async function setFeatureVisibilityAction(
  flagName: string,
  target: SimpleFlagVisibility,
  confirmText?: string
): Promise<ReleasePromotionResult> {
  if (target === "global") {
    const confirmError = validateGlobalConfirmation(confirmText ?? "");
    if (confirmError) return { error: confirmError };
  }

  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  if (!isFlagReleaseEligible(flagName)) {
    return {
      error:
        "Questa funzionalità non è ancora pronta per il rilascio (placeholder o implementazione incompleta) — nessuna promozione possibile finché non ha codice applicativo reale.",
    };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  const targets = computeScopeOverrideTargetsForVisibility(target);
  const res = await applyScopeTargets(supabase, actor.id, flagName, targets);
  if (res.error) return { error: res.error };

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: [flagName] };
}

/**
 * TRAMA — RELEASE CONTROL HARDENING (11/09/2026, §A3). Azione release-level
 * di COMODO — "Promuovi tutte le funzionalità pronte": abilita l'override
 * cohort:internal-preview per OGNI feature eligible della release che non
 * lo ha già (SOLO enable, mai una disattivazione — vedi commento sopra
 * computeScopeOverrideTargetsForVisibility: una feature già a Pilot/Global
 * NON viene mai toccata/retrocessa da questa azione, resta esattamente dove
 * era). Le feature NON eligible (placeholder) sono escluse per costruzione:
 * resolveReleaseFlags le esclude già da eligibleFlagNames.
 */
export async function promoteAllEligibleReleaseFeaturesAction(releaseId: string): Promise<ReleasePromotionResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const resolved = resolveReleaseFlags(releaseId);
  if (isResolvedReleaseFlagsError(resolved)) return { error: resolved.error };
  if (resolved.eligibleFlagNames.length === 0) {
    return {
      error: "Nessuna funzionalità di questa release è pronta per il rilascio (implementata) — nessuna azione possibile.",
    };
  }

  const supabase = await createClient();
  const actor = await getAuthenticatedActor(supabase);
  if ("error" in actor) return actor;

  // Solo l'operazione "enable" di internal_preview — mai global/pilot da
  // qui, e MAI una disattivazione (vedi doc-comment sopra la funzione).
  const enableInternalOnly = computeScopeOverrideTargetsForVisibility("internal_preview").filter((t) => t.enabled);

  for (const flagName of resolved.eligibleFlagNames) {
    const res = await applyScopeTargets(supabase, actor.id, flagName, enableInternalOnly);
    if (res.error) return { error: res.error };
  }

  revalidatePath("/admin/feature-flags");
  return { affectedFlags: resolved.eligibleFlagNames };
}
