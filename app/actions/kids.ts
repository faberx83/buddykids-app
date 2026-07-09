"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { colorForName, ageFromBirthDate } from "@/lib/data/kids";
import { Kid, KidGender } from "@/lib/types";

export async function addKidAction(
  name: string,
  birthDate: string,
  gender?: KidGender,
  interests?: string[]
): Promise<{ kid?: Kid; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!name.trim()) return { error: "Inserisci un nome" };
  if (!birthDate) return { error: "Inserisci la data di nascita" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase
    .from("kids")
    .insert({
      parent_id: user.id,
      name: name.trim(),
      birth_date: birthDate,
      gender: gender ?? null,
      interests: interests ?? [],
    })
    .select("id, name, birth_date, gender, avatar_emoji, interests")
    .single();

  if (error || !data) return { error: error?.message || "Errore nel salvataggio" };

  return {
    kid: {
      id: data.id,
      name: data.name,
      age: ageFromBirthDate(data.birth_date),
      birthDate: data.birth_date ?? undefined,
      gender: (data.gender as KidGender) ?? undefined,
      emoji: data.avatar_emoji || "🙂",
      color: colorForName(data.name),
      note: "",
      interests: data.interests ?? undefined,
    },
  };
}

// Aggiorna solo gli interessi di un bambino già esistente (usato dal profilo
// genitore per completare/correggere le preferenze dopo la creazione).
export async function updateKidInterestsAction(
  kidId: string,
  interests: string[]
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("kids")
    .update({ interests })
    .eq("id", kidId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  return {};
}

// Salva la foto profilo caricata su Storage (vedi lib/storage.ts) — l'upload
// del file avviene lato client, qui salviamo solo l'URL pubblico risultante.
export async function updateKidAvatarAction(
  kidId: string,
  avatarUrl: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("kids")
    .update({ avatar_url: avatarUrl })
    .eq("id", kidId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  return {};
}
