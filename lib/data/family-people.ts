// TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (persone custom persistenti per
// "Chi fa cosa?"). Vedi supabase/migration_32_family_people.sql per lo
// schema e docs/trama-one/analysis/TRAMA_PLANNER_BETA_V1.1.1_UI_REFINEMENT.md
// §6 per il gap che questa tabella chiude ("BLOCKED — PERSISTENT FAMILY
// PERSON MODEL REQUIRED").
//
// Ownership: STESSO modello di lib/data/responsibilities.ts (kids/
// week_responsibilities) — un solo parent_id per riga, RLS
// "using (parent_id = auth.uid())". Non il modello "families/
// family_members" (lib/data/family.ts, feature separata "Invita il tuo
// partner"): vedi il commento di audit nella migrazione per il perché.
//
// Questo file NON funziona finché supabase/migration_32_family_people.sql
// non è stata applicata manualmente da Fabrizio: su un DB senza la tabella,
// getFamilyPeopleForParent() ritorna [] (stesso pattern "if (error || !data)
// return []" già usato in tutto lib/data/responsibilities.ts) — degrada
// silenziosamente, non rompe il resto del Planner.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FamilyPerson } from "@/lib/nextgen/responsibility-options";
export type { FamilyPerson };

interface RawFamilyPersonRow {
  id: string;
  display_name: string;
  emoji: string;
}

// Ordinate per created_at crescente: la prima persona aggiunta resta la
// prima in lista, ordine stabile e prevedibile invece che alfabetico (che
// riordinerebbe le chip ad ogni nuova aggiunta).
export async function getFamilyPeopleForParent(): Promise<FamilyPerson[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("family_people")
    .select("id, display_name, emoji")
    .eq("parent_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as RawFamilyPersonRow[]).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    emoji: r.emoji,
  }));
}
