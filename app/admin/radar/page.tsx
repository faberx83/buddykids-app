import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getRadarAdminOverview, type RadarAdminOverview } from "@/lib/data/radar";
import RadarAdminClient from "./RadarAdminClient";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: pagina admin
// minima. Scoperte community (nascondi / rimostra), possibili doppioni
// (stessa chiave di deduplica) e invii dubbi o rifiutati. Stesso pattern
// delle altre code admin: server component che legge (RLS: tutto solo per
// platform_admin) e client per le azioni.
export default async function RadarAdminPage() {
  let overview: RadarAdminOverview = { community: [], duplicateGroups: [], submissions: [] };
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    overview = await getRadarAdminOverview(supabase);
  }
  return <RadarAdminClient initial={overview} />;
}
