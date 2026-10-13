import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getCommunityDiscoveryById } from "@/lib/data/radar";
import { getKidsForUser } from "@/lib/data/kids";
import { getCuratedFavoriteLeadIds } from "@/lib/data/curated-favorites";
import { getCommunityDiscoveryIdsInPlanner } from "@/lib/data/external-planner-items";
import { communityFavoriteId } from "@/lib/radar/community";
import CommunityDiscoveryDetailClient from "./CommunityDiscoveryDetailClient";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: scheda di una
// scoperta segnalata da un genitore. Visibile a chi ha RADAR_ENABLED
// (finché la funzione è in anteprima). Una scoperta nascosta dall'admin
// resta leggibile solo da chi l'ha creata e dall'admin (RLS).
export default async function CommunityDiscoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profileRow?.role as string | undefined) ?? "parent";
  const [radarEnabled, plannerEnabled] = await Promise.all([
    resolveFeatureFlag({ flagName: "RADAR_ENABLED", userId: user.id, role, tenant: "family", correlationId: generateCorrelationId() }),
    resolveFeatureFlag({
      flagName: "EXTERNAL_PLANNER_ITEMS_ENABLED",
      userId: user.id,
      role,
      tenant: "family",
      correlationId: generateCorrelationId(),
    }),
  ]);
  if (!radarEnabled) return notFound();

  const discovery = await getCommunityDiscoveryById(supabase, id);
  if (!discovery) return notFound();

  const [kids, favoriteIds, idsInPlanner] = await Promise.all([
    getKidsForUser(),
    getCuratedFavoriteLeadIds(),
    plannerEnabled ? getCommunityDiscoveryIdsInPlanner() : Promise.resolve(new Set<string>()),
  ]);

  return (
    <CommunityDiscoveryDetailClient
      discovery={discovery}
      kids={kids}
      initialFavorite={favoriteIds.has(communityFavoriteId(discovery.id))}
      plannerEnabled={plannerEnabled}
      initialInPlanner={idsInPlanner.has(discovery.id)}
      fromRadar={from === "radar"}
    />
  );
}
