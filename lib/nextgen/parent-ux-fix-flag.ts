// TRAMA — CORREZIONI DAL TEST UX (21/10/2026). Risoluzione lato server di
// PARENT_UX_FIX_ENABLED per le pagine che non hanno già un loader con i flag
// (Gruppi, dettaglio gruppo, La tua famiglia): stesso schema di
// groupsV2Enabled. Qualunque errore → false: tutto come prima.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { PARENT_UX_FIX_FLAG } from "@/lib/nextgen/parent-ux-fix";

export async function parentUxFixEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const r = await resolveFeatureFlagVisibility({
      flagName: PARENT_UX_FIX_FLAG,
      userId: user.id,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    return r.enabled;
  } catch {
    return false;
  }
}
