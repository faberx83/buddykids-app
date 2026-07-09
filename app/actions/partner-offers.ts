"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logGestoreAction } from "@/lib/data/activity-log";
import { AdminPartnerOffer } from "@/lib/data/partner-offers";

export interface PartnerOfferInput {
  category: string;
  emoji: string;
  name: string;
  description: string;
  contactLabel: string;
  contactHref: string;
  imageUrl?: string | null;
}

export async function createPartnerOfferAction(
  input: PartnerOfferInput
): Promise<{ offer?: AdminPartnerOffer; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.name.trim()) return { error: "Inserisci il nome del fornitore" };
  if (!input.contactHref.trim()) return { error: "Inserisci un contatto (email, telefono o sito)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase
    .from("partner_offers")
    .insert({
      category: input.category,
      emoji: input.emoji || "🤝",
      name: input.name,
      description: input.description,
      contact_label: input.contactLabel,
      contact_href: input.contactHref,
      active: true,
      image_url: input.imageUrl ?? null,
    })
    .select("id, category, emoji, name, description, contact_label, contact_href, active, image_url")
    .single();

  if (error || !data) return { error: error?.message || "Errore nella creazione del fornitore" };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "partner_offer_create",
    entityType: "partner_offer",
    entityId: data.id,
  });

  return {
    offer: {
      id: data.id,
      category: data.category,
      emoji: data.emoji,
      name: data.name,
      description: data.description || "",
      contactLabel: data.contact_label,
      contactHref: data.contact_href,
      active: data.active,
      imageUrl: data.image_url ?? undefined,
    },
  };
}

export async function updatePartnerOfferAction(
  id: string,
  input: PartnerOfferInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("partner_offers")
    .update({
      category: input.category,
      emoji: input.emoji || "🤝",
      name: input.name,
      description: input.description,
      contact_label: input.contactLabel,
      contact_href: input.contactHref,
      ...(input.imageUrl !== undefined ? { image_url: input.imageUrl } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "partner_offer_update",
    entityType: "partner_offer",
    entityId: id,
  });

  return {};
}

export async function togglePartnerOfferAction(
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("partner_offers").update({ active }).eq("id", id);
  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "partner_offer_toggle",
    entityType: "partner_offer",
    entityId: id,
    meta: { active },
  });

  return {};
}

export async function deletePartnerOfferAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("partner_offers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "partner_offer_delete",
    entityType: "partner_offer",
    entityId: id,
  });

  return {};
}
