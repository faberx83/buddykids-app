import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCommunitiesForUser } from "@/lib/data/communities";
import CommunityListClient from "./CommunityListClient";

// SPRINT 4 (NEXTGEN) — 4ª voce di NextgenBottomNav: elenco delle community di
// cui si fa parte + creazione/adesione tramite codice invito.
export default async function CommunityPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per vedere e creare Community con dati reali.
      </div>
    );
  }

  const communities = await getCommunitiesForUser();
  return <CommunityListClient initialCommunities={communities} />;
}
