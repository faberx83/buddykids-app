"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/email";

// Segna presente/assente/in ritardo un bambino in un giorno specifico di una
// settimana di camp. Upsert su (kid_id, week_id, date) — vedi vincolo unique
// in migration_06_profilo_esteso_presenze.sql. La RLS su "attendance_records"
// garantisce che solo il gestore del centro proprietario dell'attività possa
// scrivere (o un platform_admin).
// "in_ritardo" arriva tipicamente dal check-in del genitore (Home, vedi
// app/actions/checkin.ts): quando il GESTORE scrive qui esplicitamente,
// checked_in_by torna a "center" — è la "conferma/correzione" richiesta da
// Fabrizio ("il gestore può confermare 'in ritardo' verso 'Presente'/'Assente'").
export async function setAttendanceAction(input: {
  activityId: string;
  weekId: string;
  kidId: string;
  date: string;
  status: "presente" | "assente" | "in_ritardo";
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
      checked_in_by: "center",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kid_id,week_id,date" }
  );

  if (error) return { error: error.message };

  // Notifica email al genitore quando il gestore marca ESPLICITAMENTE un
  // bambino assente (richiesta di Fabrizio). Nota: essendo un toggle, ogni
  // click che porta lo stato ad "assente" invia una email — non c'è
  // deduplica oltre a questo, scelta accettabile per un MVP (nessuna
  // infrastruttura di notifiche push esiste ancora in questo stack, vedi
  // discussione con Fabrizio sul check-in geolocalizzato). Best-effort: un
  // eventuale errore nell'invio non fa fallire il salvataggio della presenza.
  if (input.status === "assente" && isEmailConfigured) {
    try {
      const [{ data: kidRow }, { data: activityRow }] = await Promise.all([
        supabase.from("kids").select("name, parent_id").eq("id", input.kidId).single(),
        supabase.from("activities").select("name").eq("id", input.activityId).single(),
      ]);
      if (kidRow?.parent_id) {
        const { data: parentRow } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", kidRow.parent_id)
          .single();
        if (parentRow?.email) {
          const dateLabel = new Date(input.date + "T00:00:00Z").toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          await sendEmail({
            to: parentRow.email,
            subject: `${kidRow.name}: risultato assente oggi`,
            html: `<p>Ciao${parentRow.full_name ? " " + parentRow.full_name.split(" ")[0] : ""},</p>
<p><strong>${kidRow.name}</strong> risulta <strong>assente</strong> per <strong>${activityRow?.name ?? "l'attività"}</strong> di ${dateLabel}.</p>
<p>Se si tratta di un errore o di un ritardo, contatta il centro.</p>`,
          });
        }
      }
    } catch {
      // best effort — non blocca il salvataggio della presenza
    }
  }

  revalidatePath("/center/attendance");
  return {};
}
