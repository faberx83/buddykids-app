"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { GroupItem, PublicGroupItem, GroupInviteItem, CarpoolLeg } from "@/lib/types";
import { discountForGroupSize } from "@/lib/groups";
import { getPublicGroups, getMyGroupInvites } from "@/lib/data/groups";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sendEmail, isEmailConfigured } from "@/lib/email";
// Wave 1 "Pilot Observability" (audit TRAMA_PILOT_ARCHITECTURE_REVIEW.md
// sez.9/sez.11) — conteggi aggregati di adozione Gruppi/Carpool, MAI un
// identificativo utente nel payload (context serve solo a evitare una
// seconda query di sessione, vedi PersistProductEventContext). Nessun nuovo
// call site per la logica esistente: solo un evento in più dopo un successo
// già determinato dal codice invariato sopra/sotto.
import { persistProductEvent } from "@/lib/telemetry/events";
// Push notifications (31/08/2026) — trigger P0 "invito gruppo". Best-effort
// per costruzione (sendPushToUser non lancia mai): un invito riuscito non
// deve MAI dipendere dalla riuscita della push.
import { sendPushToUser } from "@/lib/push/send";

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

  await persistProductEvent(
    { event: "group_created", tenant: "family", role: "parent" },
    { supabase, userId: user.id }
  );

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

  await persistProductEvent(
    { event: "group_joined", tenant: "family", role: "parent", detail: "via_link" },
    { supabase, userId: user.id }
  );

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return {};
}

// ─────────────────────────────────────────────
// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): gap
// segnalato da Fabrizio, analisi approfondita conferma che nessuna delle due
// tab aveva mai avuto logica reale dietro ("funzionalità in arrivo" statico).
// ─────────────────────────────────────────────

// Wrapper lato server action (già esposta anche come funzione dati pura in
// lib/data/groups.ts): utile per un refresh client-side della tab "Scopri"
// senza dover ricaricare l'intera pagina /groups.
export async function getPublicGroupsAction(): Promise<PublicGroupItem[]> {
  return getPublicGroups();
}

export async function getMyGroupInvitesAction(): Promise<GroupInviteItem[]> {
  return getMyGroupInvites();
}

// Visibilità "Scopri": solo il creatore del gruppo può renderlo pubblico o
// riportarlo privato (stesso perimetro della policy RLS "Groups: il
// creatore collega l'attività target", che copre già l'update di QUALUNQUE
// colonna per created_by = auth.uid(), is_public incluso — nessuna nuova
// policy di UPDATE necessaria, vedi migration_25).
export async function toggleGroupVisibilityAction(
  groupId: string,
  isPublic: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: group } = await supabase.from("groups").select("created_by").eq("id", groupId).maybeSingle();
  if (!group) return { error: "Gruppo non trovato" };
  if (group.created_by !== user.id) return { error: "Solo chi ha creato il gruppo può cambiarne la visibilità" };

  const { error } = await supabase.from("groups").update({ is_public: isPublic }).eq("id", groupId);
  if (error) return { error: error.message };

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return {};
}

// Invito reale per email (in aggiunta al link "Invita famiglie" già
// esistente, aperto a chiunque abbia il link) — stesso pattern collaudato di
// inviteToFamilyAction (app/actions/family.ts): token univoco, invio email
// via lib/email.ts se configurata (altrimenti l'invito resta comunque
// creato e visibile nella tab "Inviti" del destinatario appena effettua
// l'accesso, nessuna funzionalità bloccata). Aperto a QUALUNQUE membro del
// gruppo (non solo al creatore), stesso perimetro di "Invita famiglie".
export interface InviteToGroupResult {
  error?: string;
  emailSent?: boolean;
  link?: string;
}

export async function inviteToGroupAction(groupId: string, email: string): Promise<InviteToGroupResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const invitedEmail = email.trim().toLowerCase();
  if (!invitedEmail || !invitedEmail.includes("@")) return { error: "Inserisci un'email valida" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  if (user.email && user.email.toLowerCase() === invitedEmail) {
    return { error: "Non puoi invitare te stesso" };
  }

  const { data: membership } = await supabase
    .from("group_members")
    .select("parent_id")
    .eq("group_id", groupId)
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Non fai parte di questo gruppo" };

  const { data: existingInvite } = await supabase
    .from("group_invites")
    .select("id")
    .eq("group_id", groupId)
    .ilike("invited_email", invitedEmail)
    .in("status", ["pending", "sent"])
    .maybeSingle();
  if (existingInvite) return { error: "Questa email è già stata invitata a questo gruppo" };

  const { data: group } = await supabase.from("groups").select("name").eq("id", groupId).single();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const token = crypto.randomUUID();
  const { data: invite, error } = await supabase
    .from("group_invites")
    .insert({ group_id: groupId, invited_email: invitedEmail, token, invited_by: user.id })
    .select("id")
    .single();
  if (error || !invite) return { error: error?.message || "Errore nella creazione dell'invito" };

  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/auth/login?next=${encodeURIComponent("/groups")}`;

  let emailSent = false;
  if (isEmailConfigured) {
    const inviterName = profile?.full_name || "Un genitore";
    const groupName = group?.name || "un gruppo";
    const html = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color:#1a2b3c;">
        <h2 style="margin: 0 0 12px;">Ciao,</h2>
        <p><b>${inviterName}</b> ti ha invitato a unirti al gruppo <b>"${groupName}"</b> su TRAMA, per organizzarvi insieme e ottenere lo sconto gruppo.</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${link}" style="background:#6F63C5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; display:inline-block;">Vedi l'invito</a>
        </p>
        <p style="font-size:12px; color:#888;">Accedi con l'email a cui è arrivato questo invito (${invitedEmail}) e lo troverai nella tab "Inviti" di Gruppi.</p>
      </div>
    `;
    const sendResult = await sendEmail({
      to: invitedEmail,
      subject: `${inviterName} ti invita su TRAMA 🤝`,
      html,
    });
    if (!sendResult.error) {
      emailSent = true;
      await supabase.from("group_invites").update({ status: "sent", email_sent_at: new Date().toISOString() }).eq("id", invite.id);
    }
  }

  // Push notifications, trigger P0 "invito gruppo" — SOLO se la persona
  // invitata è già un profilo TRAMA registrato (l'invito è per email, non
  // per user_id: chi non si è mai registrato non ha né un profilo né una
  // subscription push, sendPushToUser sarebbe comunque un no-op in quel
  // caso, ma evitiamo anche la query profiles inutile quando non serve).
  const { data: invitedProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", invitedEmail)
    .maybeSingle();
  if (invitedProfile) {
    await sendPushToUser(invitedProfile.id, {
      title: "Nuovo invito a un gruppo",
      body: `${profile?.full_name || "Un genitore"} ti ha invitato al gruppo "${group?.name || "un gruppo"}".`,
      deepLink: "/nextgen/groups?tab=inviti",
    });
  }

  revalidatePath(`/groups/${groupId}`);
  return { emailSent, link };
}

export interface RespondGroupInviteResult {
  error?: string;
  groupId?: string;
}

export async function acceptGroupInviteAction(inviteId: string): Promise<RespondGroupInviteResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase.rpc("accept_group_invite", { p_invite_id: inviteId }).maybeSingle();
  if (error) return { error: error.message };
  const row = data as { group_id: string | null; error: string | null } | null;
  if (!row || row.error) return { error: row?.error || "Errore nell'accettazione dell'invito" };

  await persistProductEvent(
    { event: "group_joined", tenant: "family", role: "parent", detail: "via_invite" },
    { supabase, userId: user.id }
  );

  revalidatePath("/groups");
  return { groupId: row.group_id || undefined };
}

export async function declineGroupInviteAction(inviteId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase.rpc("decline_group_invite", { p_invite_id: inviteId }).maybeSingle();
  if (error) return { error: error.message };
  const row = data as { error: string | null } | null;
  if (row?.error) return { error: row.error };

  revalidatePath("/groups");
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

  // Il gestore del centro può aver personalizzato le fasce di sconto gruppo
  // (centers.group_discount_tiers) — altrimenti si usano quelle di default.
  const { data: centerRow } = await supabase
    .from("centers")
    .select("group_discount_tiers")
    .eq("id", centerId)
    .maybeSingle();
  const customTiers = centerRow?.group_discount_tiers as
    | { minKids: number; percent: number }[]
    | null
    | undefined;
  const discountPercent = discountForGroupSize(kidsCount, customTiers ?? undefined);

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

  // Push notifications, trigger P0 "nuova richiesta gruppo" — a TUTTI gli
  // admin di quel centro (un centro può avere più account center_admin
  // collegati, vedi profiles.center_id): stesso principio "notifica chi può
  // agire", non solo il primo trovato.
  const { data: groupRow } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();
  const { data: centerAdmins } = await supabase
    .from("profiles")
    .select("id")
    .eq("center_id", centerId)
    .eq("role", "center_admin");
  await Promise.all(
    (centerAdmins ?? []).map((admin) =>
      sendPushToUser(admin.id, {
        title: "Nuova richiesta gruppo",
        body: `${groupRow?.name || "Un gruppo"} — ${kidsCount} bambin${kidsCount === 1 ? "o" : "i"}, sconto ${discountPercent}%.`,
        deepLink: "/center/group-requests",
      })
    )
  );

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

  // Distingue "prima creazione" da "modifica di un'offerta già esistente":
  // l'evento carpool_offer_created deve contare adozione (quante offerte
  // NUOVE), non ogni salvataggio di un form già usato prima (altrimenti un
  // genitore che aggiorna i posti disponibili 5 volte genererebbe 5 eventi).
  const { data: existingOffer } = await supabase
    .from("carpool_offers")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("parent_id", user.id)
    .maybeSingle();

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

  if (!existingOffer) {
    await persistProductEvent(
      { event: "carpool_offer_created", tenant: "family", role: "parent" },
      { supabase, userId: user.id }
    );
  }

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

  // Stesso motivo del pre-check in upsertCarpoolOfferAction: distingue
  // "prima richiesta" da "modifica di una richiesta già esistente".
  const { data: existingRequest } = await supabase
    .from("carpool_requests")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("parent_id", user.id)
    .maybeSingle();

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

  if (!existingRequest) {
    await persistProductEvent(
      { event: "carpool_request_created", tenant: "family", role: "parent" },
      { supabase, userId: user.id }
    );
  }

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
