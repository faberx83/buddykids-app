import PreferitiView from "@/components/PreferitiView";
import { getUnifiedFavoritesForParent } from "@/lib/data/favorites";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getKidsForUser } from "@/lib/data/kids";
import type { Kid } from "@/lib/types";
import SalvatiV2View from "./SalvatiV2View";

// SALVATI V2 (15/10/2026): con DISCOVER_V2_ENABLED stessa pagina nello stile
// di Scopri V2 (SalvatiV2View); fail-closed, altrimenti la vista di prima.
export default async function NextgenPreferitiPage() {
  let v2 = false;
  let kids: Kid[] = [];
  let plannerEnabled = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = (profile?.role as string) ?? "parent";
      const flag = (flagName: string) =>
        resolveFeatureFlag({ flagName, userId: user.id, role, tenant: "family", correlationId: generateCorrelationId() }).catch(() => false);
      [v2, plannerEnabled] = await Promise.all([flag("DISCOVER_V2_ENABLED"), flag("EXTERNAL_PLANNER_ITEMS_ENABLED")]);
      if (v2) kids = await getKidsForUser().catch(() => []);
    }
  }
  const favorites = await getUnifiedFavoritesForParent();
  if (v2) return <SalvatiV2View favorites={favorites} kids={kids} plannerEnabled={plannerEnabled} />;
  return <PreferitiView favorites={favorites} showBrandIcon />;
}
