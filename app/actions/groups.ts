"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { GroupItem, CarpoolLeg } from "@/lib/types";
import { discountForGroupSize } from "@/lib/groups";
import { revalidatePath } from "next/cache";

// Traduce i messaggi di errore Postgres più comuni in qualcosa di leggibile
// per un genitore, invece di mostrare il testo tecnico del database.
function friendlyDbError(message: string, fallback: string): string {
  if (message.includes("group_kids_group_id_kid_id_key") || message.includes("duplicate key")) {
    return "Questo bambino è già iscritto a questo gruppo.";
  }
  return fallback || message;
}

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

// ─────────────────────────────────────────────
// Dettaglio gruppo: attività target, bambini + preferenze, aggregazioni
// ─────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Unione a un gruppo tramite link di invito (/groups/join/[id]). La policy
// RLS su group_members permette a qualunque utente autenticato di
// aggiungersi da solo conoscendo l'id del gruppo (come un invito "chiunque
// abbia il link"): qui gestiamo solo il caso "già membro" in modo pulito.
export async function joinGroupAction(groupId: string): Promise<{ error?: string; alreadyMember?: boolean }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: existing } = await supabase
    .from("group_members")
    .select("parent_id")
    .eq("group_id", groupId)
    .eq("parent_id", user.id)
    .maybeSingle();

  if (existing) return { alreadyMember: true };

  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, parent_id: user.id });

  if (error) return { error: friendlyDbError(error.message, "Errore nell'adesione al gruppo") };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function setGroupActivityAction(
  groupId: string,
  activityDbId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("groups")
    .update({ activity_id: activityDbId })
    .eq("id", groupId);

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function addKidToGroupAction(
  groupId: string,
  kidId: string,
  preferredTagId: string | null,
  notes: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("group_kids").insert({
    group_id: groupId,
    kid_id: kidId,
    parent_id: user.id,
    preferred_tag_id: preferredTagId,
    notes: notes.trim() || null,
  });

  if (error) return { error: friendlyDbError(error.message, "Errore nell'aggiunta del bambino") };

  // Il primo bambino aggiunto implica anche l'adesione al gruppo (idempotente
  // grazie alla chiave primaria group_id+parent_id: se già membro, l'errore
  // di duplicato viene ignorato).
  await supabase.from("group_members").insert({ group_id: groupId, parent_id: user.id });

  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function removeKidFromGroupAction(
  groupId: string,
  groupKidId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("group_kids")
    .delete()
    .eq("id", groupKidId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

// Genera le aggregazioni: raggruppa i bambini iscritti per preferenza (tag),
// sostituendo i sotto-gruppi generati in precedenza. È un primo livello
// "v1": raggruppa per preferenza dichiarata; l'incrocio fine con calendario e
// posti residui avviene quando il gruppo invia la Richiesta Gruppo al centro
// (che verifica davvero la disponibilità prima di accettare).
export async function generateSubgroupsAction(groupId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: kidsRows, error: kidsError } = await supabase
    .from("group_kids")
    .select("id, preferred_tag_id, tags ( label )")
    .eq("group_id", groupId);
  if (kidsError) return { error: kidsError.message };

  const { data: oldSubgroups } = await supabase
    .from("group_subgroups")
    .select("id")
    .eq("group_id", groupId);
  const oldIds = (oldSubgroups ?? []).map((s: { id: string }) => s.id);
  if (oldIds.length > 0) {
    await supabase.from("group_subgroup_kids").delete().in("subgroup_id", oldIds);
    await supabase.from("group_subgroups").delete().in("id", oldIds);
  }

  function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }

  const byTag = new Map<string, { label: string; kidRowIds: string[] }>();
  const noPreference: string[] = [];
  (kidsRows as { id: string; preferred_tag_id: string | null; tags: { label: string } | { label: string }[] | null }[]).forEach(
    (row) => {
      if (!row.preferred_tag_id) {
        noPreference.push(row.id);
        return;
      }
      const tag = firstOf(row.tags);
      const entry = byTag.get(row.preferred_tag_id) ?? { label: tag?.label || row.preferred_tag_id, kidRowIds: [] };
      entry.kidRowIds.push(row.id);
      byTag.set(row.preferred_tag_id, entry);
    }
  );

  for (const [tagId, { label, kidRowIds }] of byTag) {
    const { data: sg, error: sgError } = await supabase
      .from("group_subgroups")
      .insert({ group_id: groupId, label, tag_id: tagId })
      .select("id")
      .single();
    if (sgError || !sg) continue;
    await supabase
      .from("group_subgroup_kids")
      .insert(kidRowIds.map((groupKidId) => ({ subgroup_id: sg.id, group_kid_id: groupKidId })));
  }

  if (noPreference.length > 0) {
    const { data: sg } = await supabase
      .from("group_subgroups")
      .insert({ group_id: groupId, label: "Senza preferenza indicata", tag_id: null })
      .select("id")
      .single();
    if (sg) {
      await supabase
        .from("group_subgroup_kids")
        .insert(noPreference.map((groupKidId) => ({ subgroup_id: sg.id, group_kid_id: groupKidId })));
    }
  }

  revalidatePath(`/groups/${groupId}`);
  return {};
}

// ─────────────────────────────────────────────
// Richiesta Gruppo — invia al centro la richiesta di sconto proporzionale
// ─────────────────────────────────────────────
export async function sendGroupRequestAction(
  groupId: string,
  message: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: group } = await supabase
    .from("groups")
    .select("activity_id, activities ( center_id )")
    .eq("id", groupId)
    .single();

  if (!group?.activity_id) {
    return { error: "Collega prima un'attività al gruppo (vedi in alto nella pagina)." };
  }

  function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }
  const activityRef = firstOf(group.activities as { center_id: string } | { center_id: string }[] | null);
  const centerId = activityRef?.center_id;
  if (!centerId) return { error: "Impossibile trovare il centro collegato all'attività." };

  const { count } = await supabase
    .from("group_kids")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  const kidsCount = count ?? 0;
  const discountPercent = discountForGroupSize(kidsCount);

  const { error } = await supabase.from("group_requests").insert({
    group_id: groupId,
    activity_id: group.activity_id,
    center_id: centerId,
    requested_by: user.id,
    kids_count: kidsCount,
    discount_percent: discountPercent,
    message: message.trim() || null,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function respondGroupRequestAction(
  requestId: string,
  accept: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("group_requests")
    .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };
  revalidatePath("/center/group-requests");
  return {};
}

// ─────────────────────────────────────────────
// Accompagnamento — offerte auto disponibili e richieste di passaggio
// ─────────────────────────────────────────────
export async function upsertCarpoolOfferAction(
  groupId: string,
  seatsAvailable: number,
  hasChildSeat: boolean,
  legs: CarpoolLeg,
  notes: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("carpool_offers").upsert(
    {
      group_id: groupId,
      parent_id: user.id,
      seats_available: seatsAvailable,
      has_child_seat: hasChildSeat,
      legs,
      notes: notes.trim() || null,
    },
    { onConflict: "group_id,parent_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function removeCarpoolOfferAction(groupId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("carpool_offers")
    .delete()
    .eq("group_id", groupId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function upsertCarpoolRequestAction(
  groupId: string,
  kidsCount: number,
  needsChildSeat: boolean,
  legs: CarpoolLeg
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("carpool_requests").upsert(
    {
      group_id: groupId,
      parent_id: user.id,
      kids_count: kidsCount,
      needs_child_seat: needsChildSeat,
      legs,
    },
    { onConflict: "group_id,parent_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function removeCarpoolRequestAction(groupId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("carpool_requests")
    .delete()
    .eq("group_id", groupId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return {};
}
