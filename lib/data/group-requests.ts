// Richieste Gruppo in arrivo per il centro del Gestore loggato — mostrate in
// /center/group-requests.

import { GroupRequestItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawRow {
  id: string;
  group_id: string;
  kids_count: number;
  discount_percent: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  groups: { name: string } | { name: string }[] | null;
  activities: { name: string } | { name: string }[] | null;
  centers: { name: string } | { name: string }[] | null;
}

export async function getGroupRequestsForCenter(): Promise<GroupRequestItem[]> {
  if (!isSupabaseConfigured) return [];

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return [];

  const supabase = await createClient();
  let query = supabase
    .from("group_requests")
    .select(
      "id, group_id, kids_count, discount_percent, message, status, created_at, groups ( name ), activities ( name ), centers ( name )"
    )
    .order("created_at", { ascending: false });

  if (centerDbId && !isPlatformAdmin) {
    query = query.eq("center_id", centerDbId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as RawRow[]).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: firstOf(row.groups)?.name || "Gruppo",
    activityName: firstOf(row.activities)?.name || "",
    centerName: firstOf(row.centers)?.name || "",
    kidsCount: row.kids_count,
    discountPercent: Number(row.discount_percent),
    message: row.message || "",
    status: row.status,
    createdAt: row.created_at,
  }));
}
