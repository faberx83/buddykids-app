"use server";

// SPRINT 4 (NEXTGEN) — Server actions "Community": creazione/adesione
// (tramite link o codice — vedi generateUniqueCode, stesso pattern di
// app/actions/invites.ts), proposta attività, interesse/voto, e "genera
// Gruppo" dalla proposta (relazione richiesta con i "Gruppi" esistenti).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Stessi caratteri di app/actions/invites.ts (niente 0/O/1/I, ambigui da
// leggere/dettare a voce quando il codice viene condiviso a mano).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function generateUniqueInviteCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data } = await supabase.from("communities").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return code;
  }
  return randomCode(8); // fallback, collisione estremamente improbabile
}

export async function createCommunityAction(
  name: string,
  description: string
): Promise<{ communityId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!name.trim()) return { error: "Inserisci un nome per la community" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const code = await generateUniqueInviteCode(supabase);
  const { data: community, error } = await supabase
    .from("communities")
    .insert({ name: name.trim(), description: description.trim() || null, created_by: user.id, invite_code: code })
    .select("id")
    .single();

  if (error || !community) return { error: error?.message || "Errore nella creazione della community" };

  const { error: memberError } = await supabase
    .from("community_members")
    .insert({ community_id: community.id, parent_id: user.id, role: "creatore" });
  if (memberError) return { error: memberError.message };

  revalidatePath("/nextgen/community");
  return { communityId: community.id };
}

function friendlyDbError(message: string, fallback: string): string {
  if (message.includes("community_members_pkey") || message.includes("duplicate key")) {
    return "Fai già parte di questa community.";
  }
  return fallback || message;
}

export async function joinCommunityByCodeAction(
  inviteCode: string
): Promise<{ communityId?: string; error?: string; alreadyMember?: boolean }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const code = inviteCode.trim().toUpperCase();
  if (!code) return { error: "Inserisci un codice invito" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: community, error: findError } = await supabase
    .from("communities")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();
  if (findError || !community) return { error: "Codice non valido. Controlla e riprova." };

  const { data: existing } = await supabase
    .from("community_members")
    .select("parent_id")
    .eq("community_id", community.id)
    .eq("parent_id", user.id)
    .maybeSingle();
  if (existing) return { communityId: community.id, alreadyMember: true };

  const { error } = await supabase
    .from("community_members")
    .insert({ community_id: community.id, parent_id: user.id, role: "membro" });
  if (error) return { error: friendlyDbError(error.message, "Errore nell'adesione alla community") };

  revalidatePath("/nextgen/community");
  return { communityId: community.id };
}

export async function proposeActivityAction(
  communityId: string,
  activityDbId: string,
  note: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("community_activity_proposals").insert({
    community_id: communityId,
    activity_id: activityDbId,
    proposed_by: user.id,
    note: note.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/nextgen/community/${communityId}`);
  return {};
}

export async function expressInterestAction(
  proposalId: string,
  communityId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("community_activity_interest")
    .upsert({ proposal_id: proposalId, parent_id: user.id }, { onConflict: "proposal_id,parent_id" });
  if (error) return { error: error.message };

  revalidatePath(`/nextgen/community/${communityId}`);
  return {};
}

export async function withdrawInterestAction(
  proposalId: string,
  communityId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("community_activity_interest")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("parent_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/nextgen/community/${communityId}`);
  return {};
}

// "Quando una proposta della community matura, si può generare da lì un
// Gruppo sconto vero e proprio" (relazione richiesta con i "Gruppi"
// esistenti) — crea un vero gruppo (public.groups) collegato all'attività
// della proposta, con community_id valorizzato, poi segue lo stesso flusso
// già collaudato in /groups (Richiesta Gruppo al centro, car pooling).
export async function spawnGroupFromProposalAction(
  proposalId: string,
  communityId: string
): Promise<{ groupId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: proposal, error: proposalError } = await supabase
    .from("community_activity_proposals")
    .select("activity_id, communities ( name )")
    .eq("id", proposalId)
    .maybeSingle();
  if (proposalError || !proposal) return { error: "Proposta non trovata" };

  function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }
  const community = firstOf(proposal.communities as { name: string } | { name: string }[] | null);

  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name: community?.name ? `Gruppo ${community.name}` : "Gruppo dalla community",
      activity_id: proposal.activity_id,
      community_id: communityId,
      created_by: user.id,
      discount_percent: 0,
    })
    .select("id")
    .single();
  if (error || !group) return { error: error?.message || "Errore nella creazione del gruppo" };

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, parent_id: user.id });
  if (memberError) return { error: memberError.message };

  revalidatePath(`/nextgen/community/${communityId}`);
  revalidatePath("/groups");
  return { groupId: group.id };
}
