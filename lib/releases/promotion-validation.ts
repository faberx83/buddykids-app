// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Validazione pura per il Promotion Engine (app/actions/releases.ts).
// Nessun I/O, nessun "use server"/"server-only": testabile direttamente col
// runner Playwright grezzo, senza bisogno di un ambiente Supabase — stesso
// principio già seguito da lib/feature-flags/evaluate.ts e
// lib/telemetry/known-events.ts nel resto del repository (separare la
// logica pura, testabile, dall'I/O che la circonda).

import { getReleaseById, ReleaseCatalogEntry } from "./catalog";
import { getFeatureCatalog, isFeatureReleaseEligible } from "@/lib/feature-registry/catalog";
import { INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY, SimpleFlagVisibility } from "./visibility";

export interface ResolvedReleaseFlags {
  release: ReleaseCatalogEntry;
  /** Nomi flag distinti (dedup) governanti le feature di questa release, nell'ordine di apparizione. */
  flagNames: string[];
  // TRAMA — RELEASE CONTROL HARDENING (11/09/2026, richiesta Fabrizio: "una
  // feature può essere promossa a INTERNAL/PILOT/GLOBAL solo se è realmente
  // IMPLEMENTED + release-eligible"). Sottoinsieme di flagNames i cui
  // rispettivi FeatureCatalogEntry hanno releaseEligible=true — QUESTO è
  // l'unico elenco che il Promotion Engine (app/actions/releases.ts) può
  // mai scrivere. flagNames resta invariato (usato per la vista Admin
  // read-only, che deve mostrare lo stato di OGNI feature inclusa la
  // placeholder, non solo quelle promuovibili).
  eligibleFlagNames: string[];
  /** Chiavi (featureKeys) gated da un flag ma NON release-eligible — mostrato in UI per spiegare perché non hanno controlli di promozione. */
  ineligibleFeatureKeys: string[];
  /** Chiavi presenti in featureKeys ma assenti dal Feature Catalog — segnalato, mai ignorato silenziosamente. */
  unknownFeatureKeys: string[];
  /** Chiavi presenti nel Feature Catalog ma SENZA flagName — quella feature è già live per tutti (non gated), esclusa dalla promotion. */
  ungatedFeatureKeys: string[];
}

/**
 * Risolve una release nell'elenco dei flag che la governano, leggendo SOLO
 * dati statici (Release Catalog + Feature Catalog, entrambi codice, nessuna
 * query DB) — usata sia dal Promotion Engine (per sapere quali override
 * toccare) sia da lib/data/releases.ts (per sapere quali override leggere).
 */
export function resolveReleaseFlags(releaseId: string): ResolvedReleaseFlags | { error: string } {
  const release = getReleaseById(releaseId);
  if (!release) {
    return { error: `Release sconosciuta nel catalogo: "${releaseId}"` };
  }

  const catalog = getFeatureCatalog();
  const flagNames: string[] = [];
  const eligibleFlagNames: string[] = [];
  const ineligibleFeatureKeys: string[] = [];
  const unknownFeatureKeys: string[] = [];
  const ungatedFeatureKeys: string[] = [];

  for (const key of release.featureKeys) {
    const entry = catalog.find((e) => e.key === key);
    if (!entry) {
      unknownFeatureKeys.push(key);
      continue;
    }
    if (!entry.flagName) {
      ungatedFeatureKeys.push(key);
      continue;
    }
    if (!flagNames.includes(entry.flagName)) flagNames.push(entry.flagName);
    if (isFeatureReleaseEligible(entry)) {
      if (!eligibleFlagNames.includes(entry.flagName)) eligibleFlagNames.push(entry.flagName);
    } else {
      ineligibleFeatureKeys.push(key);
    }
  }

  return { release, flagNames, eligibleFlagNames, ineligibleFeatureKeys, unknownFeatureKeys, ungatedFeatureKeys };
}

export function isResolvedReleaseFlagsError(
  result: ResolvedReleaseFlags | { error: string }
): result is { error: string } {
  return "error" in result;
}

/**
 * Conferma testuale forte per la promozione a GLOBAL — STESSO pattern già
 * in produzione in app/admin/feature-flags/FeatureFlagsAdminClient.tsx
 * (BatchBetaControls: l'utente deve scrivere "GLOBAL", un click non basta).
 * Pura e case/whitespace-insensitive come l'originale, per riuso identico
 * anche lato Server Action (che non può fidarsi di una validazione fatta
 * solo lato client).
 */
export function validateGlobalConfirmation(confirmText: string): string | undefined {
  if ((confirmText ?? "").trim().toUpperCase() !== "GLOBAL") {
    return 'Scrivi "GLOBAL" per confermare — questa azione rende la funzionalità visibile a TUTTI gli utenti.';
  }
  return undefined;
}

/**
 * TRAMA — DARK RELEASE, fix audit (11/09/2026, verifica "audit promotion
 * history" richiesta da Fabrizio). Trovato leggendo app/actions/releases.ts:
 * demoteReleaseToInternalAction() riabilita SEMPRE l'override
 * cohort:internal-preview come ultimo passo del kill switch, anche quando
 * era GIA' enabled=true (caso comune: l'override interno resta acceso per
 * tutto il ciclo INTERNAL->PILOT->GLOBAL, non viene mai disattivato dalle
 * altre due azioni). Senza questo controllo, upsertScopeOverride eseguiva
 * comunque un UPDATE non necessario che ri-timbrava updated_by/updated_at
 * su quella riga con l'attore/il momento del kill switch — rendendo
 * l'audit FUORVIANTE: sembrerebbe che qualcuno abbia "toccato" la
 * visibilità interna in quel momento, quando in realtà nessun valore e'
 * cambiato li'. Pura, testabile senza Supabase: un upsert deve scrivere
 * SOLO quando il valore richiesto e' effettivamente diverso da quello
 * attuale, altrimenti updated_by/updated_at smettono di significare
 * "ultima volta che QUESTA riga e' cambiata davvero".
 */
export function shouldSkipOverrideWrite(currentEnabled: boolean, targetEnabled: boolean): boolean {
  return currentEnabled === targetEnabled;
}

/**
 * TRAMA — RELEASE CONTROL HARDENING (11/09/2026). true SOLO se `flagName` è
 * governato da almeno una voce del Feature Catalog con releaseEligible=true.
 * Usata da OGNI azione del Promotion Engine PRIMA di scrivere qualunque
 * override — un flag senza nessuna voce eligible nel catalogo (placeholder,
 * mai implementato) non riceve MAI un override tramite un'azione di
 * release, a nessun livello (nemmeno Anteprima Interna — preferenza
 * esplicita di Fabrizio: "anche INTERNAL solo quando la feature ha codice
 * realmente implementato").
 */
export function isFlagReleaseEligible(flagName: string): boolean {
  return getFeatureCatalog().some((entry) => entry.flagName === flagName && isFeatureReleaseEligible(entry));
}

export interface ScopeOverrideTarget {
  scopeType: "cohort" | "global";
  scopeValue: string | null;
  enabled: boolean;
}

/**
 * TRAMA — RELEASE CONTROL HARDENING (11/09/2026, §A2). Deriva le 3
 * operazioni di scope (cohort:internal-preview, cohort:pilot, global)
 * necessarie per portare UN flag esattamente allo stato "parlante" `target`
 * — funzione PURA del solo target (non dello stato attuale): applicare
 * questo risultato è per costruzione idempotente e corretto da QUALUNQUE
 * stato di partenza, coerente con "ogni transizione deve essere
 * idempotente" (§A4). Modello "a scala cumulativa": uno stato più alto
 * implica sempre acceso anche ogni scope sotto di esso (pilot ⇒ anche
 * internal acceso; global ⇒ anche pilot e internal accesi) — stessa
 * semantica già usata da demoteReleaseToInternalAction prima di questo
 * hardening, generalizzata qui a tutti e 4 gli stati.
 *
 * USO A DUE VELOCITÀ (deliberato, vedi app/actions/releases.ts):
 * - Un'azione ESPLICITA a singola feature/release (bottone cliccato da
 *   Fabrizio) applica TUTTE e 3 le operazioni, incluse quelle che
 *   DISATTIVANO uno scope più alto — è una decisione deliberata, può
 *   retrocedere.
 * - L'azione bulk "Promuovi tutte le funzionalità pronte" applica SOLO le
 *   operazioni con enabled=true (mai una disattivazione) — una promozione
 *   di comodo non deve MAI retrocedere una feature già più avanti nel
 *   ciclo di vita.
 */
export function computeScopeOverrideTargetsForVisibility(target: SimpleFlagVisibility): ScopeOverrideTarget[] {
  return [
    { scopeType: "cohort", scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: target !== "disabled" },
    { scopeType: "cohort", scopeValue: PILOT_COHORT_KEY, enabled: target === "pilot" || target === "global" },
    { scopeType: "global", scopeValue: null, enabled: target === "global" },
  ];
}
