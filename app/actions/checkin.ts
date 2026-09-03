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
  // Segnalazione Fabrizio 03/09/2026 ("non vedo la notifica di check-in"):
  // una prenotazione "Giorni spot" non ha una vera activity_weeks — weekId
  // è ora opzionale, activityDayId lo sostituisce in quel caso (MAI
  // entrambi). Vedi supabase/migration_35_attendance_day_based.sql (NON
  // ANCORA applicata): finché non lo è, chiamare questa action con
  // activityDayId fallisce con un errore Postgres esplicito (colonna/
  // vincolo mancanti) invece di un crash silenzioso — comportamento
  // temporaneo e atteso, non un bug di questo commit.
  weekId?: string | null;
  activityDayId?: string | null;
  kidId: string;
  date: string;
  status: "presente" | "in_ritardo" | "assente";
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.weekId && !input.activityDayId) {
    return { error: "Check-in non valido: manca sia la settimana che il giorno di riferimento." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("attendance_records").upsert(
    {
      activity_id: input.activityId,
      week_id: input.weekId ?? null,
      activity_day_id: input.activityDayId ?? null,
      kid_id: input.kidId,
      date: input.date,
      status: input.status,
      checked_in_by: "parent",
      checkin_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    // IMPORTANTE: il target di ON CONFLICT resta "kid_id,week_id,date" per
    // un check-in a settimana — INVARIATO, stesso vincolo di sempre, mai
    // toccato da migration_35 (vedi commento lì, "IMPORTANTE"). Un
    // check-in "a giorno" (activityDayId) usa invece "kid_id,occurrence_id,
    // date", il nuovo vincolo additivo che quella migrazione introduce —
    // non esiste finché non viene applicata, quindi SOLO questo secondo
    // ramo fallisce con un errore esplicito prima di allora (mai il primo,
    // mai una regressione per i check-in a settimana già funzionanti).
    { onConflict: input.activityDayId ? "kid_id,occurrence_id,date" : "kid_id,week_id,date" }
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
