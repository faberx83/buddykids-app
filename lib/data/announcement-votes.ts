import "server-only";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Voti 👍/👎 dell'utente sulle
// Novità "In arrivo" (tabella announcement_votes, migration 40). Se la
// tabella non esiste ancora, `available` è false e la pagina Novità non
// mostra i pulsanti: mai un controllo visibile che non salva nulla.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMissingTableError, type AnnouncementVote } from "@/lib/announcements/votes";

export interface MyAnnouncementVotes {
  available: boolean;
  votes: Record<string, AnnouncementVote>;
}

export async function getMyAnnouncementVotes(announcementIds: string[]): Promise<MyAnnouncementVotes> {
  if (!isSupabaseConfigured || announcementIds.length === 0) return { available: false, votes: {} };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { available: false, votes: {} };

  const { data, error } = await supabase
    .from("announcement_votes")
    .select("announcement_id, vote")
    .eq("parent_id", user.id)
    .in("announcement_id", announcementIds);

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("[announcement-votes] lettura fallita:", error.message);
    }
    return { available: false, votes: {} };
  }

  const votes: Record<string, AnnouncementVote> = {};
  for (const row of (data ?? []) as { announcement_id: string; vote: number }[]) {
    if (row.vote === 1 || row.vote === -1) votes[row.announcement_id] = row.vote;
  }
  return { available: true, votes };
}
