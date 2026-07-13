"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResponsibleValue, Weekday, Moment } from "@/lib/data/responsibilities";
import { revalidatePath } from "next/cache";

const PLANNER_PATH = "/nextgen/planner";

// SPRINT CORRETTIVO — granularità per singolo giorno feriale (weekday) e
// momento (andata/ritorno), non più un'unica assegnazione per l'intera
// settimana (vedi commento in supabase/schema.sql e lib/nextgen/
// responsibility-options.ts).
export async function setResponsibilityAction(
  kidId: string,
  weekStartDate: string,
  weekday: Weekday,
  moment: Moment,
  responsible: ResponsibleValue,
  responsibleLabel?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (responsible === "altro" && !responsibleLabel?.trim()) {
    return { error: "Scrivi chi si occupa del ritiro" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("week_responsibilities").upsert(
    {
      parent_id: user.id,
      kid_id: kidId,
      week_start_date: weekStartDate,
      weekday,
      moment,
      responsible,
      responsible_label: responsible === "altro" ? responsibleLabel!.trim() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "parent_id,kid_id,week_start_date,weekday,moment" }
  );

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}

export async function clearResponsibilityAction(
  kidId: string,
  weekStartDate: string,
  weekday: Weekday,
  moment: Moment
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("week_responsibilities")
    .delete()
    .eq("parent_id", user.id)
    .eq("kid_id", kidId)
    .eq("week_start_date", weekStartDate)
    .eq("weekday", weekday)
    .eq("moment", moment);

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}
