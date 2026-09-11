// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Validazione pura per il Promotion Engine (app/actions/releases.ts).
// Nessun I/O, nessun "use server"/"server-only": testabile direttamente col
// runner Playwright grezzo, senza bisogno di un ambiente Supabase — stesso
// principio già seguito da lib/feature-flags/evaluate.ts e
// lib/telemetry/known-events.ts nel resto del repository (separare la
// logica pura, testabile, dall'I/O che la circonda).

import { getReleaseById, ReleaseCatalogEntry } from "./catalog";
import { getFeatureCatalog } from "@/lib/feature-registry/catalog";

export interface ResolvedReleaseFlags {
  release: ReleaseCatalogEntry;
  /** Nomi flag distinti (dedup) governanti le feature di questa release, nell'ordine di apparizione. */
  flagNames: string[];
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
  }

  return { release, flagNames, unknownFeatureKeys, ungatedFeatureKeys };
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
