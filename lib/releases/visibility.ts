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

// TRAMA — RELEASE CONTROL HARDENING (11/09/2026, §A2, sostituisce il
// precedente "un solo bottone avanti per card" del fix lifecycle
// dell'11/09 mattina). Fabrizio, dopo l'uso reale su Calendar Export: "la UI
// semplificata deve diventare reversibile" — ogni stato mostra ora l'intera
// scaletta di transizioni ammesse (avanti E indietro), non solo "il
// prossimo gradino". Applicata oggi a livello di SINGOLA FEATURE (§A3: "voglio
// poter controllare una singola feature senza dover necessariamente
// promuovere l'intero bundle") — la stessa funzione, stesso identico
// vocabolario, si applica altrettanto bene a un flag isolato o a un'intera
// release (nel raro caso in cui tutte le feature condividano esattamente lo
// stesso SimpleFlagVisibility).
export type ReleaseLadderButtonKind = "primary" | "secondary" | "tertiary";

export interface ReleaseLadderButton {
  target: SimpleFlagVisibility;
  label: string;
  kind: ReleaseLadderButtonKind;
  /** true SOLO per il salto a "global" — richiede la conferma testuale "GLOBAL" (stesso pattern già in produzione). */
  requiresGlobalConfirm?: boolean;
}

/**
 * Bottoni ammessi per lo stato corrente di UN flag/feature — mai per
 * "mixed" (quello resta un concetto di aggregazione a livello di intera
 * release, non di una singola feature: una feature singola ha sempre uno
 * dei 4 stati semplici, mai "mixed"). Wording e ordine ESATTI dalla
 * richiesta di Fabrizio (§A2):
 *   DISATTIVATO   -> primary [Abilita anteprima interna]
 *   INTERNAL      -> primary [Estendi al Pilot] · secondary [Disattiva]
 *   PILOT         -> primary [Pubblica a tutti] · secondary [Riporta a Anteprima interna] · tertiary [Disattiva]
 *   GLOBAL        -> secondary [Riporta al Pilot] · secondary [Riporta a Anteprima interna] · tertiary [Disattiva]
 * "Estendi al Pilot" (non "Abilita al Pilot"): Pilot NON significa "tutti" —
 * Global resta l'unico stato che significa tutti gli utenti (richiesta
 * esplicita, per evitare l'ambiguità di wording che ha originato questo
 * hardening).
 */
export function ladderButtonsForVisibility(visibility: SimpleFlagVisibility): ReleaseLadderButton[] {
  switch (visibility) {
    case "disabled":
      return [{ target: "internal_preview", label: "Abilita anteprima interna", kind: "primary" }];
    case "internal_preview":
      return [
        { target: "pilot", label: "Estendi al Pilot", kind: "primary" },
        { target: "disabled", label: "Disattiva", kind: "secondary" },
      ];
    case "pilot":
      return [
        { target: "global", label: "Pubblica a tutti", kind: "primary", requiresGlobalConfirm: true },
        { target: "internal_preview", label: "Riporta a Anteprima interna", kind: "secondary" },
        { target: "disabled", label: "Disattiva", kind: "tertiary" },
      ];
    case "global":
      return [
        { target: "pilot", label: "Riporta al Pilot", kind: "secondary" },
        { target: "internal_preview", label: "Riporta a Anteprima interna", kind: "secondary" },
        { target: "disabled", label: "Disattiva", kind: "tertiary" },
      ];
  }
}
