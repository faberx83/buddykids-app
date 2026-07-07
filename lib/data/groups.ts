// Gruppi ("Andiamo Insieme") del genitore loggato — da Supabase (tabelle
// groups/group_members) quando collegato. Per privacy non leggiamo i nomi
// reali degli altri membri (le regole di sicurezza del database non lo
// permettono, ed è corretto così): mostriamo il proprio avatar reale + un
// conteggio "+N famiglie" per gli altri iscritti.

import { GroupItem } from "@/lib/types";
import { groups as mockGroups } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const MEMBER_PALETTE = [
  { bg: "#B8DFF6", color: "#2a8dc4" },
  { bg: "#FFD0BB", color: "#d4622a" },
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
