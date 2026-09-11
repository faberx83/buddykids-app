import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCheckinActionToken, isCheckinActionTokenError } from "@/lib/checkin/action-token";
import { sendEmail, isEmailConfigured } from "@/lib/email";

// TRAMA — Push check-in: azioni rapide (11/09/2026). Endpoint pubblico
// (nessuna sessione richiesta: il chiamante è il service worker, che non ha
// i cookie dell'app — vedi lib/checkin/action-token.ts) ma protetto da un
// token firmato che autorizza ESATTAMENTE una scrittura, generata al
// momento dell'invio della push (app/api/cron/checkin-reminders/route.ts) —
// NON è un endpoint generico "scrivi un check-in qualsiasi", solo il
// redentore di quel token specifico.
//
// Scrittura IDENTICA a quella di app/actions/checkin.ts::parentCheckinAction
// (stesso upsert, stesso target onConflict, stessa email "in ritardo" al
// centro) — duplicata qui invece di riusata perché parentCheckinAction è una
// Server Action "use server" che richiede una sessione client (auth.getUser()),
// irraggiungibile da questo contesto. Se in futuro le due scritture
// divergono per un fix, vanno aggiornate insieme — stesso principio già
// accettato per il duplicato analogo upsertScopeOverride/parentCheckinAction
// in questo codebase quando un secondo canale di scrittura non può
// condividere la Server Action originale.
//
// Metodo POST (mai GET): anche se il payload arriva da un link firmato
// interno mai esposto pubblicamente, un'azione che scrive dati non deve
// rispondere a un semplice prefetch/crawler — il service worker chiama
// esplicitamente fetch(url, { method: "POST" }).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token mancante" }, { status: 400 });

  const verified = verifyCheckinActionToken(token);
  if (isCheckinActionTokenError(verified)) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  // IMPORTANTE: il target di ON CONFLICT segue la STESSA regola di
  // parentCheckinAction — "kid_id,week_id,date" per un check-in a settimana,
  // "kid_id,occurrence_id,date" per un check-in a giorno (vedi
  // supabase/migration_35_attendance_day_based.sql, applicata).
  const { error } = await service.from("attendance_records").upsert(
    {
      activity_id: verified.activityId,
      week_id: verified.weekId,
      activity_day_id: verified.activityDayId,
      kid_id: verified.kidId,
      date: verified.date,
      status: verified.status,
      checked_in_by: "parent",
      checkin_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: verified.activityDayId ? "kid_id,occurrence_id,date" : "kid_id,week_id,date" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "Siamo in ritardo": stesso avviso email al centro già previsto da
  // parentCheckinAction — best effort, non blocca la risposta.
  if (verified.status === "in_ritardo" && isEmailConfigured) {
    try {
      const [{ data: kidRow }, { data: activityRow }] = await Promise.all([
        service.from("kids").select("name").eq("id", verified.kidId).single(),
        service.from("activities").select("name, centers ( contact_email )").eq("id", verified.activityId).single(),
      ]);
      const centersVal = activityRow?.centers as { contact_email: string | null } | { contact_email: string | null }[] | null;
      const center = Array.isArray(centersVal) ? centersVal[0] : centersVal;
      if (center?.contact_email) {
        await sendEmail({
          to: center.contact_email,
          subject: `${kidRow?.name ?? "Un bambino"}: in ritardo oggi`,
          html: `<p><strong>${kidRow?.name ?? "Il bambino"}</strong> è segnalato IN RITARDO dal genitore (azione rapida dalla notifica) per <strong>${
            activityRow?.name ?? "l'attività"
          }</strong> di oggi.</p>`,
        });
      }
    } catch {
      // best effort — non blocca la risposta all'azione rapida
    }
  }

  return NextResponse.json({ ok: true, status: verified.status });
}
