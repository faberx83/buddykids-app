// TRAMA — GRUPPI V2 (14/10/2026). Risoluzione lato server del flag
// GROUPS_V2_ENABLED per le pagine /nextgen/groups e /nextgen/groups/[id]:
// stesso schema di bookingsV2Enabled (app/nextgen/prenotazioni/page.tsx).
// Qualunque errore → false: restano le pagine attuali.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

export async function groupsV2Enabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const r = await resolveFeatureFlagVisibility({
      flagName: "GROUPS_V2_ENABLED",
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
