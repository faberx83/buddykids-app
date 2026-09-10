// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Logica pura (nessun I/O, nessun "server-only") che decide se
// InternalPreviewBadge (components/InternalPreviewBadge.tsx) deve comparire
// in una pagina. Estratta in un file a parte, senza dipendenze da Next/
// Supabase, per essere testabile direttamente col runner Playwright grezzo
// — stesso principio già seguito da lib/command-center/priority.ts e
// lib/telemetry/known-events.ts nel resto del repository.
//
// Regola: il badge NON compare solo perché l'utente appartiene alla coorte
// "internal-preview" — compare quando ALMENO UNA capability effettivamente
// risolta in quella pagina è visibile a quell'utente PROPRIO grazie allo
// scope cohort:"internal-preview" (non global, non pilot, non un altro
// scope). Un utente Beta/Pilot che vede la stessa feature tramite lo scope
// cohort "trama-one-controlled-beta" non deve mai vedere questo badge.
//
// Uso previsto (quando una pagina reale gaterà una capability dark, non
// ancora oggi — nessuna pagina la chiama in questa sessione): la pagina
// chiama resolveFeatureFlagVisibility() per ciascun flag che governa il suo
// contenuto invece di resolveFeatureFlag(), raccoglie i risultati in un
// array e li passa a anyResolvedViaInternalPreview() per decidere il prop
// `visible` di <InternalPreviewBadge />.

import { FeatureFlagEvaluationDetail } from "./evaluate";
import { INTERNAL_PREVIEW_COHORT_KEY } from "@/lib/releases/visibility";

/**
 * true se questo singolo risultato di resolveFeatureFlagVisibility/
 * evaluateFlagDetailed è "abilitato, e lo è grazie allo scope
 * cohort:internal-preview specificamente" — normalizzato come
 * lib/feature-flags/evaluate.ts (trim + lowercase), stesso principio.
 */
export function isResolvedViaInternalPreview(detail: FeatureFlagEvaluationDetail): boolean {
  if (!detail.enabled) return false;
  if (detail.matchedScope !== "cohort") return false;
  const value = (detail.matchedScopeValue ?? "").trim().toLowerCase();
  return value === INTERNAL_PREVIEW_COHORT_KEY;
}

/**
 * true se ALMENO UNO dei risultati passati è stato risolto tramite
 * internal-preview — è questo il valore da passare come prop `visible` a
 * InternalPreviewBadge quando una pagina gate più di una capability.
 */
export function anyResolvedViaInternalPreview(details: FeatureFlagEvaluationDetail[]): boolean {
  return (details ?? []).some(isResolvedViaInternalPreview);
}
