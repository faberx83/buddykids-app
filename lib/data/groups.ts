// Gruppi ("Andiamo Insieme") del genitore loggato — da Supabase (tabelle
// groups/group_members) quando collegato. Per privacy non leggiamo i nomi
// reali degli altri membri (le regole di sicurezza del database non lo
// permettono, ed è corretto così): mostriamo il proprio avatar reale + un
// conteggio "+N famiglie" per gli altri iscritti.

import { GroupItem, PublicGroupItem, GroupInviteItem } from "@/lib/types";
import { groups as mockGroups } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const MEMBER_PALETTE = [
  { bg: "#B8DFF6", color: "#2a8dc4" },
  { bg: "#FFD0BB", color: "#F6A623" },
  { bg: "#A8EDE2", color: "#1fa88e" },
  { bg: "#E8F9EE", color: "#2d8f52" },
  { bg: "#F0EEFF", color: "#6b58d4" },
];

function styleForName(name: string): { bg: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return MEMBER_PALETTE[hash % MEMBER_PALETTE.length];
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawActivityRef {
  emoji: string | null;
  img_gradient: string | null;
  city: string | null;
  centers: { name: string } | { name: string }[] | null;
}

interface RawGroupRow {
  id: string;
  name: string;
  discount_percent: number | null;
  activities: RawActivityRef | RawActivityRef[] | null;
  group_members: { parent_id: string }[] | null;
}

export async function getGroupsForUser(): Promise<GroupItem[]> {
  if (!isSupabaseConfigured) return mockGroups;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  const selfName: string =
    profile?.full_name?.trim() || profile?.email?.split("@")[0] || user.email?.split("@")[0] || "Tu";
  const selfStyle = styleForName(selfName);

  const { data: memberRows, error: memberErr } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("parent_id", user.id);
  if (memberErr || !memberRows || memberRows.length === 0) return [];

  const groupIds = memberRows.map((m) => m.group_id);

  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, discount_percent, activities ( emoji, img_gradient, city, centers ( name ) ), group_members ( parent_id )"
    )
    .in("id", groupIds);

  if (error || !data) return [];

  return (data as unknown as RawGroupRow[]).map((row) => {
    const activity = firstOf(row.activities);
    const center = activity ? firstOf(activity.centers) : null;
    const totalFamilies = row.group_members?.length ?? 1;
    const discount = row.discount_percent ?? 0;
    return {
      id: row.id,
      name: row.name,
      emoji: activity?.emoji || "🤝",
      gradient: activity?.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      location: center?.name || activity?.city || "Da definire",
      dateRange: "",
      members: [{ initials: initialsFor(selfName), ...selfStyle }],
      extraMembers: totalFamilies > 1 ? totalFamilies - 1 : undefined,
      totalFamilies,
      discountLabel: discount > 0 ? `Sconto ${discount}%` : "Invita amici",
      discountBadgeColor: discount > 0 ? "green" : "orange",
    };
  });
}

// ─────────────────────────────────────────────
// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): due nuove
// query, entrambe via RPC security definer (vedi migration_25) invece di
// query dirette sulle tabelle: "Scopri" deve calcolare un conteggio famiglie
// aggregato per gruppi di cui il chiamante NON è membro (la RLS di
// group_members lo impedirebbe in una query diretta); "Inviti" deve trovare
// gli inviti indirizzati all'email del genitore loggato, indipendentemente
// dal fatto che sia già membro di un qualsiasi gruppo o meno.
// ─────────────────────────────────────────────

interface RawPublicGroupRow {
  id: string;
  name: string;
  discount_percent: number | null;
  activity_name: string | null;
  activity_emoji: string | null;
  activity_gradient: string | null;
  center_name: string | null;
  city: string | null;
  family_count: number | string | null; // count(*) può tornare come stringa via PostgREST
}

export async function getPublicGroups(): Promise<PublicGroupItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("list_public_groups");
  if (error || !data) return [];

  return (data as RawPublicGroupRow[]).map((row) => {
    const discount = row.discount_percent ?? 0;
    return {
      id: row.id,
      name: row.name,
      emoji: row.activity_emoji || "🤝",
      gradient: row.activity_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      location: row.center_name || row.city || "Da definire",
      familyCount: Number(row.family_count ?? 0),
      discountLabel: discount > 0 ? `Sconto ${discount}%` : "Invita amici",
      discountBadgeColor: discount > 0 ? "green" : "orange",
    };
  });
}

interface RawGroupInviteRow {
  invite_id: string;
  group_id: string;
  group_name: string;
  activity_name: string | null;
  center_name: string | null;
  discount_percent: number | null;
  inviter_name: string | null;
  created_at: string;
}

export async function getMyGroupInvites(): Promise<GroupInviteItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("list_my_group_invites");
  if (error || !data) return [];

  return (data as RawGroupInviteRow[]).map((row) => ({
    id: row.invite_id,
    groupId: row.group_id,
    groupName: row.group_name,
    activityName: row.activity_name,
    centerName: row.center_name,
    discountPercent: Number(row.discount_percent ?? 0),
    inviterName: row.inviter_name,
    createdAt: row.created_at,
  }));
}
