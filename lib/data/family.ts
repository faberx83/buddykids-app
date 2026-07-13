// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: lettura della
// famiglia del genitore loggato (se esiste) + elenco membri con nome/email,
// tramite la funzione security definer get_family_members() (vedi
// supabase/schema.sql — profiles resta a lettura solo-proprietario, quindi
// serve una funzione dedicata per vedere il nome degli altri membri).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Family, FamilyMember, FamilyRole } from "@/lib/nextgen/family-roles";
export type { Family, FamilyMember, FamilyRole };

interface RawMemberRow {
  parent_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  joined_at: string;
}

export async function getFamilyForUser(): Promise<Family | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  const { data: family } = await supabase
    .from("families")
    .select("id, name, invite_code")
    .eq("id", membership.family_id)
    .maybeSingle();
  if (!family) return null;

  const { data: memberRows } = await supabase.rpc("get_family_members");
  const rows = (memberRows ?? []) as RawMemberRow[];

  return {
    id: family.id,
    name: family.name,
    inviteCode: family.invite_code,
    myRole: membership.role as FamilyRole,
    members: rows.map((r) => ({
      parentId: r.parent_id,
      fullName: r.full_name,
      email: r.email,
      role: r.role as FamilyRole,
      joinedAt: r.joined_at,
      isMe: r.parent_id === user.id,
    })),
  };
}
