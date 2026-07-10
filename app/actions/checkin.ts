"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/email";

// Check-in MVP lato genitore: risposta manuale a "[Bambino] è arrivato/a a
// [Attività]?" (Sì/Siamo in ritardo/No) — vedi lib/data/checkin.ts per il
// perché non c'è geolocalizzazione/push automatica. La RLS aggiuntiva in
// schema.sql ("Attendance: il genitore fa il check-in dei propri bambini")
// garantisce che un genitore possa scrivere solo per i propri bambini.
export async function parentCheckinAction(input: {
  activityId: string;
  weekId: string;
  kidId: string;
  date: string;
  status: "presente" | "in_ritardo" | "assente";
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
      checked_in_by: "parent",
      checkin_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kid_id,week_id,date" }
  );

  if (error) return { error: error.message };

  // "Siamo in ritardo": avvisa il centro via email (nessuna infra push,
  // scelta di scope MVP concordata con Fabrizio) — best effort, non blocca.
  if (input.status === "in_ritardo" && isEmailConfigured) {
    try {
      const [{ data: kidRow }, { data: activityRow }] = await Promise.all([
        supabase.from("kids").select("name").eq("id", input.kidId).single(),
        supabase
          .from("activities")
          .select("name, centers ( contact_email )")
          .eq("id", input.activityId)
          .single(),
      ]);
      const centersVal = activityRow?.centers as { contact_email: string | null } | { contact_email: string | null }[] | null;
      const center = Array.isArray(centersVal) ? centersVal[0] : centersVal;
      if (center?.contact_email) {
        await sendEmail({
          to: center.contact_email,
          subject: `${kidRow?.name ?? "Un bambino"}: in ritardo oggi`,
          html: `<p><strong>${kidRow?.name ?? "Il bambino"}</strong> è segnalato IN RITARDO dal genitore per <strong>${
            activityRow?.name ?? "l'attività"
          }</strong> di oggi.</p>`,
        });
      }
    } catch {
      // best effort — non blocca il salvataggio del check-in
    }
  }

  revalidatePath("/");
  revalidatePath("/center/attendance");
  return {};
}
