"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Tag } from "@/lib/types";
import { logGestoreAction } from "@/lib/data/activity-log";

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTagAction(
  label: string,
  emoji: string,
  bg: string
): Promise<{ tag?: Tag; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!label.trim()) return { error: "Inserisci un nome per il tag" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const id = slugify(label);

  const { data, error } = await supabase
    .from("tags")
    .insert({ id, label: label.trim(), emoji, bg_color: bg })
    .select("id, label, emoji, bg_color")
    .single();

  if (error || !data) return { error: error?.message || "Errore nella creazione del tag" };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "tag_create",
    entityType: "tag",
    entityId: data.id,
  });

  return { tag: { id: data.id, label: data.label, emoji: data.emoji, bg: data.bg_color } };
}

export async function deleteTagAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: null,
    action: "tag_delete",
    entityType: "tag",
    entityId: id,
  });

  return {};
}
