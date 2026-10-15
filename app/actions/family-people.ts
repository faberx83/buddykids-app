"use server";

// TRAMA — "CHI VI AIUTA" (15/10/2026). Prima le persone (Zia Carla, la
// vicina…) nascevano solo scrivendo "Altro…" in Chi accompagna e non si
// potevano più rinominare né togliere. Stessa tabella family_people
// (migration_32, già applicata), stessa RLS "parent_id = auth.uid()".
// Togliere = active=false (le assegnazioni passate restano leggibili);
// rinominare aggiorna anche l'etichetta salvata nelle assegnazioni.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cleanHelperName, isBuiltInHelper } from "@/lib/nextgen/family-page-v2";

const PATHS = ["/nextgen/profile/famiglia", "/nextgen/planner"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function done() {
  for (const p of PATHS) revalidatePath(p);
}

export async function addFamilyPersonAction(rawName: string): Promise<{ error?: string; id?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const name = cleanHelperName(rawName);
  if (!name) return { error: "Scrivi un nome (massimo 40 caratteri)" };
  if (isBuiltInHelper(name)) return { error: `${name} c'è già tra le scelte di Chi accompagna` };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  // Stessa persona già salvata (anche tolta in passato): la si riattiva.
  const { data: existing } = await supabase
    .from("family_people")
    .select("id, active")
    .eq("parent_id", user.id)
    .ilike("display_name", name)
    .maybeSingle();
  if (existing) {
    if (!existing.active) {
      await supabase.from("family_people").update({ active: true, display_name: name }).eq("id", existing.id);
    }
    done();
    return { id: existing.id as string };
  }
  const { data, error } = await supabase
    .from("family_people")
    .insert({ parent_id: user.id, display_name: name })
    .select("id")
    .single();
  if (error || !data) return { error: "Non sono riuscito a salvare, riprova" };
  done();
  return { id: data.id as string };
}

export async function renameFamilyPersonAction(id: string, rawName: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const name = cleanHelperName(rawName);
  if (!name) return { error: "Scrivi un nome (massimo 40 caratteri)" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("family_people")
    .update({ display_name: name })
    .eq("id", id)
    .eq("parent_id", user.id);
  if (error) {
    return { error: error.message.includes("duplicate") ? "C'è già una persona con questo nome" : "Non sono riuscito a salvare, riprova" };
  }
  // Le assegnazioni già fatte mostrano il nome salvato: si aggiorna anche lì.
  await supabase
    .from("week_responsibilities")
    .update({ responsible_label: name })
    .eq("parent_id", user.id)
    .eq("family_person_id", id);
  done();
  return {};
}

export async function removeFamilyPersonAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };
  const { error } = await supabase.from("family_people").update({ active: false }).eq("id", id).eq("parent_id", user.id);
  if (error) return { error: "Non sono riuscito a togliere, riprova" };
  done();
  return {};
}
