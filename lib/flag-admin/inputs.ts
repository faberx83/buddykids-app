// TRAMA — Feature flag: aree e azioni in blocco (13/11/2026).
// Richiesta di Fabrizio: "Riusa le regole esistenti di precedenza, permessi e
// scadenza." Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md (Project).
//
// Adatta le righe lette da getFeatureFlagOverridesForAdmin (REUSE) al
// formato di lib/flag-admin/bulk.ts. Puro: catalogo e registro sono statici.

import { getFeatureCatalog, isFeatureReleaseEligible } from "@/lib/feature-registry/catalog";
import { isFlagReleaseEligible } from "@/lib/releases/promotion-validation";
import type { BulkFlagInput } from "./bulk";

export interface AdminEntryLike {
  flagName: string;
  description?: string;
  defaultValue: boolean;
  allowedScopes: readonly string[];
  overrides: {
    id: string;
    scopeType: string;
    scopeValue: string | null;
    enabled: boolean;
    expiresAt: string | null;
    updatedAt: string;
  }[];
}

export interface BulkFlagView extends BulkFlagInput {
  description: string;
}

export function labelForFlag(flagName: string): string {
  const entries = getFeatureCatalog().filter((e) => e.flagName === flagName);
  const best = entries.find((e) => isFeatureReleaseEligible(e)) ?? entries[0];
  return best?.label ?? flagName;
}

export function toBulkInputs(entries: AdminEntryLike[]): BulkFlagView[] {
  return entries.map((e) => ({
    flagName: e.flagName,
    label: labelForFlag(e.flagName),
    description: e.description ?? "",
    defaultValue: e.defaultValue,
    allowedScopes: e.allowedScopes,
    releaseEligible: isFlagReleaseEligible(e.flagName),
    overrides: e.overrides.map((o) => ({
      id: o.id,
      scopeType: o.scopeType,
      scopeValue: o.scopeValue,
      enabled: o.enabled,
      expiresAt: o.expiresAt,
      updatedAt: o.updatedAt,
    })),
  }));
}
