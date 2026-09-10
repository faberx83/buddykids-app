// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Vista Admin "pronta al render" del Release Catalog: per ogni release, per
// ogni feature che contiene, la visibilità DERIVATA dai suoi override reali
// in feature_flag_overrides (mai una colonna di stato) — stesso pattern di
// lib/data/feature-flag-overrides.ts (getFeatureFlagOverridesForAdmin),
// riusato qui invece di duplicare la lettura di feature_flag_overrides.

import { getReleaseCatalog } from "@/lib/releases/catalog";
import { resolveReleaseFlags, isResolvedReleaseFlagsError } from "@/lib/releases/promotion-validation";
import { getFeatureCatalog } from "@/lib/feature-registry/catalog";
import { getFeatureFlagOverridesForAdmin, FeatureFlagOverrideRow } from "./feature-flag-overrides";
import {
  deriveFlagSimpleVisibility,
  deriveReleaseVisibility,
  ReleaseVisibility,
  SimpleFlagVisibility,
} from "@/lib/releases/visibility";

export interface ReleaseFeatureAdminRow {
  key: string;
  label: string;
  flagName: string | null;
  /** "global" per le feature senza flag (già live per chiunque, non gated) — non fa parte del ciclo INTERNAL/PILOT/GLOBAL. */
  visibility: SimpleFlagVisibility;
}

export interface ReleaseAdminEntry {
  id: string;
  label: string;
  shortDescription: string;
  targetAudience: string[];
  features: ReleaseFeatureAdminRow[];
  visibility: ReleaseVisibility;
  knownLimitations?: string[];
  notes?: string;
  /** Chiavi in featureKeys assenti dal Feature Catalog — mostrato in UI invece di essere ignorato silenziosamente. */
  unknownFeatureKeys: string[];
}

export async function getReleasesForAdmin(): Promise<ReleaseAdminEntry[]> {
  const releases = getReleaseCatalog();
  if (releases.length === 0) return [];

  const [flagEntries, catalog] = await Promise.all([getFeatureFlagOverridesForAdmin(), Promise.resolve(getFeatureCatalog())]);
  const overridesByFlag = new Map<string, FeatureFlagOverrideRow[]>(flagEntries.map((e) => [e.flagName, e.overrides]));

  return releases.map((release) => {
    const resolved = resolveReleaseFlags(release.id);
    // resolveReleaseFlags rilegge il catalogo da capo internamente — qui
    // riusiamo solo il suo output per unknownFeatureKeys (per non duplicare
    // la logica di join), il resto (label/visibilità per riga) si costruisce
    // qui perché serve anche per le feature "ungated" (senza flagName), che
    // resolveReleaseFlags esclude deliberatamente da flagNames.
    const unknownFeatureKeys = isResolvedReleaseFlagsError(resolved) ? [] : resolved.unknownFeatureKeys;

    const features: ReleaseFeatureAdminRow[] = [];
    const visibilities: SimpleFlagVisibility[] = [];
    for (const key of release.featureKeys) {
      const entry = catalog.find((e) => e.key === key);
      if (!entry) continue; // già segnalata in unknownFeatureKeys sopra
      if (!entry.flagName) {
        features.push({ key, label: entry.label, flagName: null, visibility: "global" });
        visibilities.push("global");
        continue;
      }
      const overrides = overridesByFlag.get(entry.flagName) ?? [];
      const visibility = deriveFlagSimpleVisibility(overrides);
      features.push({ key, label: entry.label, flagName: entry.flagName, visibility });
      visibilities.push(visibility);
    }

    return {
      id: release.id,
      label: release.label,
      shortDescription: release.shortDescription,
      targetAudience: release.targetAudience,
      features,
      visibility: deriveReleaseVisibility(visibilities),
      knownLimitations: release.knownLimitations,
      notes: release.notes,
      unknownFeatureKeys,
    };
  });
}
