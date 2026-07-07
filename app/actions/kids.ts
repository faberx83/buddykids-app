"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { colorForName, ageFromBirthDate } from "@/lib/data/kids";
import { Kid, KidGender } from "@/lib/types";

export async function addKidAction(
  name: string,
  birthDate: string,
  gender?: KidGender
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
    .insert({ parent_id: user.id, name: name.trim(), birth_date: birthDate, gender: gender ?? null })
    .select("id, name, birth_date, gender, avatar_emoji")
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
    },
  };
}
