// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Logica pura (nessun I/O) per derivare la visibilità "parlante" di un
// flag/release dai suoi override reali in feature_flag_overrides — MAI
// duplicata in una colonna di stato: la source of truth della visibilità
// resta sempre la tabella feature_flag_overrides (letta da
// lib/data/feature-flag-overrides.ts), questo file si limita a tradurla in
// un linguaggio a 4 livelli (+ "mixed") per l'Admin UI semplificata, senza
// esporre scope_type/cohort_key. Nessuna dipendenza da Next/Supabase —
// testabile direttamente, stesso principio di lib/feature-flags/evaluate.ts.

import { FeatureFlagScope } from "@/lib/feature-flags/registry";
import { FeatureFlagOverrideStatus } from "@/lib/data/feature-flag-overrides";

// Coorte "anteprima interna" — SOLO Fabrizio + eventuali account che lui
// stesso aggiunge esplicitamente a beta_cohort_memberships con questa
// cohort_key (stessa tabella/meccanismo già usato per la Beta, nessuna
// tabella nuova — vedi supabase/migration_08_beta_cohort_memberships.sql).
// Nessun pattern di email, nessun campo nuovo su profiles: l'appartenenza è
// SOLO una riga in beta_cohort_memberships con cohort_key = questo valore,
// esattamente come richiesto.
export const INTERNAL_PREVIEW_COHORT_KEY = "internal-preview";

// Coorte "pilot" — riusa la STESSA cohort_key già in produzione per la
// Controlled Beta Cohort (default di beta_invite_codes.cohort_key, vedi
// migration_30_beta_invite_codes.sql riga ~91: 'trama-one-controlled-beta').
// Non una nuova coorte: "PILOT" in questo modello è solo il nome parlante
// per la coorte Beta che esiste già.
export const PILOT_COHORT_KEY = "trama-one-controlled-beta";

export type SimpleFlagVisibility = "internal_preview" | "pilot" | "global" | "disabled";
export type ReleaseVisibility = SimpleFlagVisibility | "mixed";

export const RELEASE_VISIBILITY_LABEL: Record<ReleaseVisibility, string> = {
  internal_preview: "Anteprima interna",
  pilot: "Pilot",
  global: "Disponibile a tutti",
  disabled: "Disattivato",
  mixed: "Rilascio parziale",
};

// Colori badge coerenti con la palette già in uso in
// FeatureFlagsAdminClient.tsx (STATUS_LABEL/CATALOG_STATUS_LABEL) — nessuna
// nuova palette inventata.
export const RELEASE_VISIBILITY_BADGE_CLASS: Record<ReleaseVisibility, string> = {
  internal_preview: "bg-sky-light text-sky",
  pilot: "bg-orange-light text-trama-orange",
  global: "bg-green-light text-[#2d8f52]",
  disabled: "bg-[#F0F2F5] text-ink-2",
  mixed: "bg-[#FFF7E6] text-[#9a6b00]",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export interface OverrideForVisibility {
  scopeType: FeatureFlagScope;
  scopeValue: string | null;
  enabled: boolean;
  status: FeatureFlagOverrideStatus;
}

/**
 * Deriva la visibilità "parlante" di UN flag dai suoi override correnti.
 * Regola (dalla più ampia alla più stretta): un override enabled=true e non
 * scaduto con scope "global" → global; altrimenti uno con scope "cohort" e
 * valore = coorte Pilot → pilot; altrimenti uno con scope "cohort" e valore
 * = coorte Anteprima Interna → internal_preview; altrimenti disabled.
 *
 * Override con altri scope (user/role/tenant/environment) esistono e restano
 * pienamente funzionanti a runtime (vedi lib/feature-flags/evaluate.ts, che
 * li considera tutti secondo la precedenza reale) ma non fanno parte di
 * questo vocabolario semplificato a 4 livelli: la vista tecnica esistente
 * (override per override, con scope_type/scope_value espliciti) resta
 * disponibile sotto la sezione Release per quei casi — limite dichiarato,
 * non un bug.
 */
export function deriveFlagSimpleVisibility(overrides: OverrideForVisibility[]): SimpleFlagVisibility {
  const active = (overrides ?? []).filter((o) => o.enabled && o.status !== "expired");
  if (active.some((o) => o.scopeType === "global")) return "global";
  if (active.some((o) => o.scopeType === "cohort" && normalize(o.scopeValue) === PILOT_COHORT_KEY)) return "pilot";
  if (active.some((o) => o.scopeType === "cohort" && normalize(o.scopeValue) === INTERNAL_PREVIEW_COHORT_KEY)) {
    return "internal_preview";
  }
  return "disabled";
}

/**
 * Aggrega la visibilità di più flag (le feature di UNA release) in un unico
 * stato. Se non sono tutte identiche, ritorna "mixed" — la UI deve mostrare
 * "Rilascio parziale", MAI il nome del primo stato trovato: mentire dicendo
 * "Pilot" quando 1 feature su 3 è ancora Anteprima Interna sarebbe
 * esattamente l'errore che questo report doveva evitare.
 */
export function deriveReleaseVisibility(flagVisibilities: SimpleFlagVisibility[]): ReleaseVisibility {
  if (flagVisibilities.length === 0) return "disabled";
  const first = flagVisibilities[0];
  return flagVisibilities.every((v) => v === first) ? first : "mixed";
}

export type ReleaseLifecycleAction = "enable_internal_preview" | "promote_to_pilot" | "promote_to_global" | "demote_to_internal";

/**
 * TRAMA — DARK RELEASE, fix lifecycle (11/09/2026, richiesta Fabrizio).
 * Prima di questo fix la card Release offriva "Abilita al Pilot" anche da
 * una release DISATTIVATA, saltando lo stadio Anteprima Interna —
 * incoerente col modello approvato:
 *   DISATTIVATO -> ANTEPRIMA INTERNA -> PILOT -> DISPONIBILE A TUTTI
 * Questa funzione è la SINGOLA fonte di verità su quale azione mostrare per
 * stato — un solo bottone "avanti" per card, mai due alternative. "mixed"
 * (feature della release a stadi diversi) offre solo il kill switch: riporta
 * tutto a un unico stadio noto (Anteprima Interna) prima di scegliere il
 * prossimo passo, mai un'azione "avanti" ambigua su uno stato che non è
 * un singolo stadio riconosciuto.
 */
export function nextReleaseLifecycleAction(visibility: ReleaseVisibility): ReleaseLifecycleAction {
  switch (visibility) {
    case "disabled":
      return "enable_internal_preview";
    case "internal_preview":
      return "promote_to_pilot";
    case "pilot":
      return "promote_to_global";
    case "global":
    case "mixed":
      return "demote_to_internal";
  }
}
