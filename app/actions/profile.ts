"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ParentRole } from "@/lib/data/profile";
import { revalidatePath } from "next/cache";

export async function updateParentProfileAction(input: {
  fullName: string;
  parentRole: ParentRole;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.fullName.trim()) return { error: "Inserisci nome e cognome" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), parent_role: input.parentRole })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/");
  return {};
}

// Salva la foto profilo caricata su Storage (vedi lib/storage.ts) — l'upload
// del file avviene lato client, qui salviamo solo l'URL pubblico risultante.
export async function updateParentAvatarAction(avatarUrl: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/");
  return {};
}

// Settimane del Planner segnate dal genitore come "non mi serve" (ferie,
// bambini dai nonni, ecc.) — persistite come array di date ISO (inizio
// settimana) sul profilo, così restano anche cambiando dispositivo.
export async function toggleWeekDismissedAction(
  weekStartDate: string,
  dismissed: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("dismissed_weeks")
    .eq("id", user.id)
    .single();

  const current: string[] = Array.isArray(profile?.dismissed_weeks) ? profile.dismissed_weeks : [];
  const next = dismissed
    ? Array.from(new Set([...current, weekStartDate]))
    : current.filter((d) => d !== weekStartDate);

  const { error } = await supabase
    .from("profiles")
    .update({ dismissed_weeks: next })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}
