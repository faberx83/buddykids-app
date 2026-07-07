"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { GroupItem } from "@/lib/types";

export async function createGroupAction(name: string): Promise<{ group?: GroupItem; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!name.trim()) return { error: "Inserisci un nome per il gruppo" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  const selfName: string =
    profile?.full_name?.trim() || profile?.email?.split("@")[0] || user.email?.split("@")[0] || "Tu";

  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), created_by: user.id, discount_percent: 0 })
    .select("id, name, discount_percent")
    .single();

  if (error || !group) return { error: error?.message || "Errore nella creazione del gruppo" };

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, parent_id: user.id });

  if (memberError) return { error: memberError.message };

  const initials =
    selfName
      .split(/\s+/)
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return {
    group: {
      id: group.id,
      name: group.name,
      emoji: "🤝",
      gradient: "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      location: "Da definire",
      dateRange: "",
      members: [{ initials, color: "#2a8dc4", bg: "#B8DFF6" }],
      extraMembers: undefined,
      totalFamilies: 1,
      discountLabel: "Invita amici",
      discountBadgeColor: "orange",
    },
  };
}
