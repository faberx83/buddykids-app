"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Segna presente/assente un bambino in un giorno specifico di una settimana
// di camp. Upsert su (kid_id, week_id, date) — vedi vincolo unique in
// migration_06_profilo_esteso_presenze.sql. La RLS su "attendance_records"
// garantisce che solo il gestore del centro proprietario dell'attività possa
// scrivere (o un platform_admin).
export async function setAttendanceAction(input: {
  activityId: string;
  weekId: string;
  kidId: string;
  date: string;
  status: "presente" | "assente";
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("attendance_records").upsert(
    {
      activity_id: input.activityId,
      week_id: input.weekId,
      kid_id: input.kidId,
      date: input.date,
      status: input.status,
      marked_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kid_id,week_id,date" }
  );

  if (error) return { error: error.message };

  revalidatePath("/center/attendance");
  return {};
}
