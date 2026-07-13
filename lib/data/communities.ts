// SPRINT 4 (NEXTGEN) — "Community": comunità persistente e multi-attività fra
// famiglie (creazione, membri/ruoli, proposte di attività condivise, voto/
// interesse), distinta dai "Gruppi" esistenti (lib/data/groups.ts, legati a
// UNA sola attività per lo sconto). Stesso principio di privacy già usato in
// group-detail.ts: non leggiamo mai nomi reali di ALTRE famiglie — solo
// un'etichetta generica ("Famiglia N").

import {
  CommunityItem,
  CommunityDetail,
  CommunityProposal,
  CommunityMemberEntry,
  CommunityHomeSignal,
  CommunityRole,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function ordinalLabel(prefix: string, index: number): string {
  return `${prefix} ${index + 1}`;
}

export async function getCommunitiesForUser(): Promise<CommunityItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberRows } = await supabase
    .from("community_members")
    .select("community_id, role")
    .eq("parent_id", user.id);
  if (!memberRows || memberRows.length === 0) return [];

  const roleByCommunity = new Map<string, CommunityRole>(
    memberRows.map((r: { community_id: string; role: CommunityRole }) => [r.community_id, r.role])
  );
  const communityIds = memberRows.map((r: { community_id: string }) => r.community_id);

  const [communitiesRes, allMembersRes, proposalsRes] = await Promise.all([
    supabase
      .from("communities")
      .select("id, name, description, image_emoji, invite_code")
      .in("id", communityIds),
    supabase.from("community_members").select("community_id").in("community_id", communityIds),
    supabase.from("community_activity_proposals").select("id, community_id").in("community_id", communityIds),
  ]);

  const membersCountByCommunity = new Map<string, number>();
  (allMembersRes.data ?? []).forEach((r: { community_id: string }) => {
    membersCountByCommunity.set(r.community_id, (membersCountByCommunity.get(r.community_id) ?? 0) + 1);
  });
  const proposalsCountByCommunity = new Map<string, number>();
  (proposalsRes.data ?? []).forEach((r: { community_id: string }) => {
    proposalsCountByCommunity.set(r.community_id, (proposalsCountByCommunity.get(r.community_id) ?? 0) + 1);
  });

  return ((communitiesRes.data ?? []) as { id: string; name: string; description: string | null; image_emoji: string | null; invite_code: string }[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      emoji: row.image_emoji || "🧑‍🤝‍🧑",
      inviteCode: row.invite_code,
      membersCount: membersCountByCommunity.get(row.id) ?? 1,
      myRole: roleByCommunity.get(row.id) ?? "membro",
      activeProposalsCount: proposalsCountByCommunity.get(row.id) ?? 0,
    })
  );
}

export async function getCommunityDetail(communityId: string): Promise<CommunityDetail | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: communityRow, error: communityError } = await supabase
    .from("communities")
    .select("id, name, description, image_emoji, invite_code")
    .eq("id", communityId)
    .maybeSingle();
  // RLS filtra le community di cui non fai parte: niente riga → nessun accesso.
  if (communityError || !communityRow) return null;

  const [membersRes, proposalsRes] = await Promise.all([
    supabase
      .from("community_members")
      .select("parent_id, role, joined_at")
      .eq("community_id", communityId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("community_activity_proposals")
      .select(
        "id, activity_id, proposed_by, note, created_at, activities ( slug, name, emoji, img_gradient, centers ( name ) )"
      )
      .eq("community_id", communityId)
      .order("created_at", { ascending: false }),
  ]);

  const memberRows = (membersRes.data ?? []) as { parent_id: string; role: CommunityRole; joined_at: string }[];
  const myRole = memberRows.find((m) => m.parent_id === user.id)?.role ?? "membro";

  let otherIndex = 0;
  const members: CommunityMemberEntry[] = memberRows.map((row) => {
    const isOwn = row.parent_id === user.id;
    return {
      parentId: row.parent_id,
      label: isOwn ? "Tu" : ordinalLabel("Famiglia", otherIndex++),
      isOwn,
      role: row.role,
    };
  });

  interface RawProposalRow {
    id: string;
    activity_id: string;
    proposed_by: string | null;
    note: string | null;
    created_at: string;
    activities:
      | { slug: string; name: string; emoji: string | null; img_gradient: string | null; centers: { name: string } | { name: string }[] | null }
      | { slug: string; name: string; emoji: string | null; img_gradient: string | null; centers: { name: string } | { name: string }[] | null }[]
      | null;
  }
  const proposalRows = (proposalsRes.data ?? []) as RawProposalRow[];
  const proposalIds = proposalRows.map((p) => p.id);
  const activityIds = Array.from(new Set(proposalRows.map((p) => p.activity_id)));
  const memberParentIds = memberRows.map((m) => m.parent_id);

  const [interestRes, bookingsRes] = await Promise.all([
    proposalIds.length > 0
      ? supabase.from("community_activity_interest").select("proposal_id, parent_id").in("proposal_id", proposalIds)
      : Promise.resolve({ data: [] as { proposal_id: string; parent_id: string }[] }),
    activityIds.length > 0
      ? supabase
          .from("bookings")
          .select("activity_id, parent_id")
          .in("activity_id", activityIds)
          .in("parent_id", memberParentIds)
          .neq("status", "cancelled")
      : Promise.resolve({ data: [] as { activity_id: string; parent_id: string }[] }),
  ]);

  const interestByProposal = new Map<string, string[]>();
  ((interestRes.data ?? []) as { proposal_id: string; parent_id: string }[]).forEach((row) => {
    const list = interestByProposal.get(row.proposal_id) ?? [];
    list.push(row.parent_id);
    interestByProposal.set(row.proposal_id, list);
  });

  // "Famiglie già iscritte": famiglie della community con una prenotazione
  // attiva su quell'attività — incrociata in lettura, nessuna tabella nuova.
  const enrolledParentsByActivity = new Map<string, Set<string>>();
  ((bookingsRes.data ?? []) as { activity_id: string; parent_id: string }[]).forEach((row) => {
    const set = enrolledParentsByActivity.get(row.activity_id) ?? new Set<string>();
    set.add(row.parent_id);
    enrolledParentsByActivity.set(row.activity_id, set);
  });

  const proposals: CommunityProposal[] = proposalRows.map((row) => {
    const activity = firstOf(row.activities);
    const center = activity ? firstOf(activity.centers) : null;
    const interestedParents = interestByProposal.get(row.id) ?? [];
    return {
      id: row.id,
      activityId: row.activity_id,
      activitySlug: activity?.slug ?? "",
      activityName: activity?.name ?? "Attività",
      activityEmoji: activity?.emoji || "🏫",
      activityGradient: activity?.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      centerName: center?.name ?? "",
      note: row.note || "",
      proposedByMe: row.proposed_by === user.id,
      interestCount: interestedParents.length,
      iAmInterested: interestedParents.includes(user.id),
      alreadyEnrolledCount: enrolledParentsByActivity.get(row.activity_id)?.size ?? 0,
      createdAt: row.created_at,
    };
  });

  return {
    id: communityRow.id,
    name: communityRow.name,
    description: communityRow.description || "",
    emoji: communityRow.image_emoji || "🧑‍🤝‍🧑",
    inviteCode: communityRow.invite_code,
    myRole,
    members,
    proposals,
  };
}

// Piccolo segnale sociale per la Home (richiesta di Fabrizio: "piccoli
// elementi sociali", solo se rilevanti) — prende la proposta con più
// interesse tra le community di cui si fa parte, se ce n'è almeno una.
export async function getCommunityHomeSignal(): Promise<CommunityHomeSignal | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberRows } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("parent_id", user.id);
  if (!memberRows || memberRows.length === 0) return null;
  const communityIds = memberRows.map((r: { community_id: string }) => r.community_id);

  const { data: proposalRows } = await supabase
    .from("community_activity_proposals")
    .select("id, community_id, activities ( name ), communities ( name )")
    .in("community_id", communityIds);
  if (!proposalRows || proposalRows.length === 0) return null;

  const proposalIds = proposalRows.map((p: { id: string }) => p.id);
  const { data: interestRows } = await supabase
    .from("community_activity_interest")
    .select("proposal_id")
    .in("proposal_id", proposalIds);

  const countByProposal = new Map<string, number>();
  (interestRows ?? []).forEach((r: { proposal_id: string }) => {
    countByProposal.set(r.proposal_id, (countByProposal.get(r.proposal_id) ?? 0) + 1);
  });

  interface RawSignalRow {
    id: string;
    community_id: string;
    activities: { name: string } | { name: string }[] | null;
    communities: { name: string } | { name: string }[] | null;
  }
  let best: { row: RawSignalRow; count: number } | null = null;
  for (const row of proposalRows as RawSignalRow[]) {
    const count = countByProposal.get(row.id) ?? 0;
    if (count === 0) continue;
    if (!best || count > best.count) best = { row, count };
  }
  if (!best) return null;

  const activity = firstOf(best.row.activities);
  const community = firstOf(best.row.communities);
  return {
    communityId: best.row.community_id,
    communityName: community?.name ?? "la tua community",
    activityName: activity?.name ?? "questo campus",
    interestCount: best.count,
  };
}
