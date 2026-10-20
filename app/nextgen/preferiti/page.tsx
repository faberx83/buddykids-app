import PreferitiView from "@/components/PreferitiView";
import { getUnifiedFavoritesForParent } from "@/lib/data/favorites";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getKidsForUser } from "@/lib/data/kids";
import type { Kid } from "@/lib/types";
import SalvatiV2View from "./SalvatiV2View";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";

// SALVATI V2 (15/10/2026): con DISCOVER_V2_ENABLED stessa pagina nello stile
// di Scopri V2 (SalvatiV2View); fail-closed, altrimenti la vista di prima.
export default async function NextgenPreferitiPage() {
  let v2 = false;
  let kids: Kid[] = [];
  let plannerEnabled = false;
  // 20/10/2026: attività salvate già prenotate (riga "Già prenotata" nella card).
  let bookedActivityDbIds: string[] = [];
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
      if (v2) {
        const [k, bookings] = await Promise.all([getKidsForUser().catch(() => []), getMyBookingsForParent().catch(() => [])]);
        kids = k;
        bookedActivityDbIds = bookings
          .filter((b) => b.status !== "cancelled" && b.partnerDecision !== "rejected")
          .map((b) => b.activityDbId)
          .filter((id): id is string => Boolean(id));
      }
    }
  }
  const favorites = await getUnifiedFavoritesForParent();
  if (v2) return <SalvatiV2View favorites={favorites} kids={kids} plannerEnabled={plannerEnabled} bookedActivityDbIds={bookedActivityDbIds} />;
  return <PreferitiView favorites={favorites} showBrandIcon />;
}
