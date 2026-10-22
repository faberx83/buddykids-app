// TRAMA — CHI ACCOMPAGNA PER PASSAGGIO (22/10/2026, release
// "chi-accompagna-per-passaggio"). Lettura di public.passage_responsibilities
// (migration 51) per il genitore collegato. Prima della migration la tabella
// non esiste: si torna una lista vuota e il Planner usa la scelta del giorno
// (week_responsibilities), come prima. Logica: lib/nextgen/passages.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Moment, ResponsibleValue } from "@/lib/nextgen/responsibility-options";
import type { PassageResponsibility } from "@/lib/nextgen/passages";

interface RawPassageRow {
  kid_id: string;
  date: string;
  passage_key: string;
  moment: string;
  responsible: string;
  responsible_label: string | null;
  family_person_id: string | null;
}

/** Le scelte per passaggio da `fromIso` in poi (il Planner guarda poco indietro). */
export async function getPassageResponsibilitiesForParent(fromIso: string): Promise<PassageResponsibility[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("passage_responsibilities")
      .select("kid_id, date, passage_key, moment, responsible, responsible_label, family_person_id")
      .eq("parent_id", user.id)
      .gte("date", fromIso);
    if (error || !data) return [];
    return (data as RawPassageRow[]).map((r) => ({
      kidId: r.kid_id,
      date: r.date,
      passageKey: r.passage_key,
      moment: r.moment as Moment,
      responsible: r.responsible as ResponsibleValue,
      responsibleLabel: r.responsible_label,
      familyPersonId: r.family_person_id,
    }));
  } catch {
    return [];
  }
}
