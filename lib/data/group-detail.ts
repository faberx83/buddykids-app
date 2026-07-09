// Dettaglio di un gruppo: bambini iscritti + preferenza, aggregazioni,
// Richiesta Gruppo e accompagnamento. Per privacy non leggiamo mai nome/dati
// reali dei bambini o dei genitori di ALTRE famiglie (le policy RLS su
// "kids" e "profiles" lo impedirebbero comunque): mostriamo solo le
// preferenze indicate e un'etichetta generica ("Bambino/a", "Famiglia 2"...).

import { GroupDetail, GroupKidEntry, GroupSubgroup, CarpoolOfferItem, CarpoolRequestItem } from "@/lib/types";
import { groups as mockGroups, kids as mockKids } from "@/lib/mock-data";
import { getKidsForUser } from "@/lib/data/kids";
import { getTags } from "@/lib/data/tags";
import { discountForGroupSize } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function ordinalLabel(prefix: string, index: number): string {
  return `${prefix} ${index + 1}`;
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const availableTags = await getTags();

  if (!isSupabaseConfigured) {
    const mockGroup = mockGroups.find((g) => g.id === groupId);
    if (!mockGroup) return null;
    return {
      id: mockGroup.id,
      name: mockGroup.name,
      emoji: mockGroup.emoji,
      gradient: mockGroup.gradient,
      createdByMe: true,
      activityId: null,
      activityName: mockGroup.location !== "Da definire" ? mockGroup.location : null,
      centerName: mockGroup.location,
      kids: [],
      subgroups: [],
      discountPercent: discountForGroupSize(mockGroup.totalFamilies),
      request: null,
      carpoolOffers: [],
      carpoolRequests: [],
      myKids: mockKids.map((k) => ({ id: k.id, name: k.name, emoji: k.emoji, interests: k.interests })),
      availableTags,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: groupRow, error: groupError } = await supabase
    .from("groups")
    .select(
      "id, name, created_by, activity_id, activities ( name, center_id, centers ( name, group_discount_tiers ) )"
    )
    .eq("id", groupId)
    .maybeSingle();

  // RLS filtra i gruppi di cui non fai parte: niente riga → nessun accesso.
  if (groupError || !groupRow) return null;

  interface CenterRef {
    name: string;
    group_discount_tiers: { minKids: number; percent: number }[] | null;
  }
  const activity = firstOf(
    groupRow.activities as
      | { name: string; center_id: string; centers: CenterRef | CenterRef[] | null }
      | { name: string; center_id: string; centers: CenterRef | CenterRef[] | null }[]
      | null
  );
  const center = activity ? firstOf(activity.centers) : null;

  const [kidsRes, subgroupsRes, subgroupKidsRes, requestRes, offersRes, requestsRes, myKidsAll] =
    await Promise.all([
      supabase
        .from("group_kids")
        .select("id, kid_id, parent_id, preferred_tag_id, notes, created_at, tags ( label )")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabase
        .from("group_subgroups")
        .select("id, label, tag_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabase.from("group_subgroup_kids").select("subgroup_id, group_kid_id"),
      supabase
        .from("group_requests")
        .select(
          "id, group_id, kids_count, discount_percent, message, status, created_at, activities ( name ), centers ( name )"
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("carpool_offers")
        .select("id, parent_id, seats_available, has_child_seat, legs, notes, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabase
        .from("carpool_requests")
        .select("id, parent_id, kids_count, needs_child_seat, legs, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      getKidsForUser(),
    ]);

  const myKidById = new Map(myKidsAll.map((k) => [k.id, k]));

  interface RawGroupKidRow {
    id: string;
    kid_id: string;
    parent_id: string;
    preferred_tag_id: string | null;
    notes: string | null;
    tags: { label: string } | { label: string }[] | null;
  }

  const kids: GroupKidEntry[] = ((kidsRes.data as RawGroupKidRow[] | null) ?? []).map((row) => {
    const isOwn = row.parent_id === user.id;
    const myKid = isOwn ? myKidById.get(row.kid_id) : undefined;
    const tag = firstOf(row.tags);
    return {
      id: row.id,
      kidId: row.kid_id,
      kidName: myKid?.name || (isOwn ? "Il tuo bambino/a" : "Bambino/a"),
      kidEmoji: myKid?.emoji || "🧒",
      isOwn,
      preferredTagId: row.preferred_tag_id,
      preferredTagLabel: tag?.label ?? null,
      notes: row.notes || "",
    };
  });

  interface RawSubgroupRow {
    id: string;
    label: string;
    tag_id: string | null;
  }
  const subgroupKidIds = new Map<string, string[]>();
  ((subgroupKidsRes.data as { subgroup_id: string; group_kid_id: string }[] | null) ?? []).forEach(
    (row) => {
      const list = subgroupKidIds.get(row.subgroup_id) ?? [];
      list.push(row.group_kid_id);
      subgroupKidIds.set(row.subgroup_id, list);
    }
  );

  const activityTagIds = new Set<string>(); // riempito sotto se serve verificare fattibilità
  if (activity) {
    const { data: activityTagRows } = await supabase
      .from("activity_tags")
      .select("tag_id")
      .eq("activity_id", groupRow.activity_id);
    (activityTagRows ?? []).forEach((r: { tag_id: string }) => activityTagIds.add(r.tag_id));
  }

  const subgroups: GroupSubgroup[] = ((subgroupsRes.data as RawSubgroupRow[] | null) ?? []).map(
    (row) => ({
      id: row.id,
      label: row.label,
      tagId: row.tag_id,
      kidIds: subgroupKidIds.get(row.id) ?? [],
      feasible: !activity || !row.tag_id ? true : activityTagIds.has(row.tag_id),
    })
  );

  interface RawRequestRow {
    id: string;
    group_id: string;
    kids_count: number;
    discount_percent: number;
    message: string | null;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
    activities: { name: string } | { name: string }[] | null;
    centers: { name: string } | { name: string }[] | null;
  }
  const requestRow = requestRes.data as RawRequestRow | null;
  const request = requestRow
    ? {
        id: requestRow.id,
        groupId: requestRow.group_id,
        groupName: groupRow.name,
        activityName: firstOf(requestRow.activities)?.name || "",
        centerName: firstOf(requestRow.centers)?.name || "",
        kidsCount: requestRow.kids_count,
        discountPercent: Number(requestRow.discount_percent),
        message: requestRow.message || "",
        status: requestRow.status,
        createdAt: requestRow.created_at,
      }
    : null;

  interface RawOfferRow {
    id: string;
    parent_id: string;
    seats_available: number;
    has_child_seat: boolean;
    legs: "dropoff" | "pickup" | "both";
    notes: string | null;
  }
  let otherIndex = 0;
  const carpoolOffers: CarpoolOfferItem[] = ((offersRes.data as RawOfferRow[] | null) ?? []).map(
    (row) => {
      const isOwn = row.parent_id === user.id;
      return {
        id: row.id,
        parentId: row.parent_id,
        parentLabel: isOwn ? "Tu" : ordinalLabel("Famiglia", otherIndex++),
        isOwn,
        seatsAvailable: row.seats_available,
        hasChildSeat: row.has_child_seat,
        legs: row.legs,
        notes: row.notes || "",
      };
    }
  );

  interface RawRequestNeedRow {
    id: string;
    parent_id: string;
    kids_count: number;
    needs_child_seat: boolean;
    legs: "dropoff" | "pickup" | "both";
  }
  let otherReqIndex = 0;
  const carpoolRequests: CarpoolRequestItem[] = (
    (requestsRes.data as RawRequestNeedRow[] | null) ?? []
  ).map((row) => {
    const isOwn = row.parent_id === user.id;
    return {
      id: row.id,
      parentId: row.parent_id,
      parentLabel: isOwn ? "Tu" : ordinalLabel("Famiglia", otherReqIndex++),
      isOwn,
      kidsCount: row.kids_count,
      needsChildSeat: row.needs_child_seat,
      legs: row.legs,
    };
  });

  const enrolledKidIds = new Set(kids.filter((k) => k.isOwn).map((k) => k.kidId));
  const myKids = myKidsAll
    .filter((k) => !enrolledKidIds.has(k.id))
    .map((k) => ({ id: k.id, name: k.name, emoji: k.emoji, interests: k.interests }));

  return {
    id: groupRow.id,
    name: groupRow.name,
    emoji: "🤝",
    gradient: "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
    createdByMe: groupRow.created_by === user.id,
    activityId: groupRow.activity_id,
    activityName: activity?.name ?? null,
    centerName: center?.name ?? null,
    kids,
    subgroups,
    discountPercent: discountForGroupSize(kids.length, center?.group_discount_tiers ?? undefined),
    groupDiscountTiers: center?.group_discount_tiers ?? undefined,
    request,
    carpoolOffers,
    carpoolRequests,
    myKids,
    availableTags,
  };
}
