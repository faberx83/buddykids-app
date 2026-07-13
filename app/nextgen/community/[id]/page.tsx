import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCommunityDetail } from "@/lib/data/communities";
import { getActivities } from "@/lib/data/activities";
import CommunityDetailClient from "./CommunityDetailClient";

// SPRINT 4 (NEXTGEN) — Dettaglio Community: membri/ruoli, proposte con
// interesse/voto, "Le attività della community", invito. Riusa getActivities
// (già esistente) per il selettore "proponi un'attività".
export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per vedere il dettaglio Community con dati reali.
      </div>
    );
  }

  const [detail, activities] = await Promise.all([getCommunityDetail(id), getActivities()]);
  if (!detail) notFound();

  return <CommunityDetailClient detail={detail} activities={activities} />;
}
