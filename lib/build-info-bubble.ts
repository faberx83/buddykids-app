import "server-only";

// TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026). Unico punto in cui si
// decide se mostrare la BuildInfoBubble: risolve BUILD_INFO_BUBBLE_ENABLED
// server-side (stesso resolver fail-safe di tutti gli altri flag: in caso di
// errore → false → nessuna bolla) e, solo se true, restituisce il label.
// Chiamato dai tre layout app/nextgen/layout.tsx (Genitori),
// app/center/layout.tsx (Gestori), app/admin/layout.tsx (Admin).
//
// RIMOZIONE: cancellare questo file, lib/build-info.ts,
// components/BuildInfoBubble.tsx, tests/one/build-info-bubble.spec.ts, la
// voce BUILD_INFO_BUBBLE_ENABLED in lib/feature-flags/registry.ts, le righe
// marcate "BUILD_INFO_BUBBLE" nei tre layout e il blocco env in
// next.config.mjs. Nessuna migration coinvolta.

import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { formatBuildLabel, getBuildInfo } from "@/lib/build-info";

export async function resolveBuildInfoBubbleLabel(params: {
  userId: string;
  role: string | null;
  tenant: "family" | "center" | "admin";
}): Promise<string | null> {
  const enabled = await resolveFeatureFlag({
    flagName: "BUILD_INFO_BUBBLE_ENABLED",
    userId: params.userId,
    role: params.role,
    tenant: params.tenant,
    correlationId: generateCorrelationId(),
  });
  return enabled ? formatBuildLabel(getBuildInfo()) : null;
}
