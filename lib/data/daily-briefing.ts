import "server-only";

// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026). Parte I/O del riepilogo del
// mattino (la logica pura è in lib/nextgen/daily-briefing.ts).
//   - runDailyBriefing(): chiamata da /api/cron/daily-briefing (alle 7 a Roma)
//     per tutti i genitori che l'hanno attivato in Profilo; oppure da "Mandamelo
//     adesso" in Preferenze, solo per chi tocca il pulsante (onlyUserId).
// Riusa lo stesso caricamento dei promemoria serali (loadFamily) e le stesse
// regole di Home e Planner (buildTodayAgenda, dayCoordinationSlots). Notifica
// con sendPushToUser (rispetta "Notifiche push"), email con Resend (rispetta
// "Notifiche email"). Nessun dato nuovo salvato oltre a un conteggio in
// product_events (mai nomi o email). Errori mai rilanciati.

import { createServiceClient } from "@/lib/supabase/service";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { sendPushToUser } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { loadFamily } from "@/lib/data/family-reminders";
import { buildTodayAgenda } from "@/lib/nextgen/today-agenda";
import { dayCoordinationSlots } from "@/lib/nextgen/planner-week";
import { buildDailyBriefing, romeNow, type BriefingModel, type DailyBriefing } from "@/lib/nextgen/daily-briefing";

export const DAILY_BRIEFING_FLAG = "DAILY_BRIEFING_ENABLED";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

interface Recipient {
  id: string;
  full_name: string | null;
  email: string | null;
  notify_email: boolean | null;
  daily_briefing_push: boolean;
  daily_briefing_email: boolean;
}

export interface DailyBriefingRunResult {
  candidates: number;
  enabled: number;
  pushes: number;
  emails: number;
  empty: number;
  /** false = migration_45 non ancora applicata */
  ready: boolean;
}

function firstName(full: string | null): string | null {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f ? f : null;
}

/**
 * Il buongiorno di un genitore per una data (stesse regole del cron).
 * "no-kids" = nessun figlio registrato; null = niente da dire oggi.
 */
async function briefingForParent(
  service: Service,
  parentId: string,
  fullName: string | null,
  dateIso: string
): Promise<DailyBriefing | null | "no-kids"> {
  const family = await loadFamily(service, parentId, dateIso);
  if (Object.keys(family.kidNameById).length === 0) return "no-kids";
  const entries = buildTodayAgenda({
    todayIso: dateIso,
    bookings: family.bookings,
    externalItems: family.externalItems,
    hoursByActivityDbId: family.hoursByActivityDbId,
    kidNameById: family.kidNameById,
    // 21/10/2026 — settimana tipo: oggi senza scuola → niente riga "Scuola".
    schoolClosedDates: family.closurePeriods.flatMap((p) => Object.values(p.weekdaysByKid).flat()),
  });
  const slots = dayCoordinationSlots({
    dateIso,
    bookings: family.bookings,
    externalItems: family.externalItems,
    responsibilities: family.responsibilities,
    kidNameById: family.kidNameById,
    labelFor: family.labelFor,
  });
  const briefing = buildDailyBriefing({
    todayIso: dateIso,
    firstName: firstName(fullName),
    entries,
    slots,
    closurePeriods: family.closurePeriods,
    kidNameById: family.kidNameById,
  });
  return briefing;
}

/**
 * Il buongiorno di oggi per il genitore collegato, per il foglio in Home
 * (28/10/2026). Stesse letture del cron (client di servizio, ma solo i dati
 * di questo genitore). Flag spento o errore → null: nessun foglio.
 */
export async function getTodayBriefingForParent(parentId: string, fullName: string | null, now: Date = new Date()): Promise<BriefingModel | null> {
  try {
    const on = await resolveFeatureFlag({ flagName: DAILY_BRIEFING_FLAG, userId: parentId, role: "parent", tenant: "family" }).catch(() => false);
    if (!on) return null;
    const service = createServiceClient();
    if (!service) return null;
    const b = await briefingForParent(service, parentId, fullName, romeNow(now).dateIso);
    return b && b !== "no-kids" ? b.model : null;
  } catch {
    return null;
  }
}

export async function runDailyBriefing(
  service: Service,
  now: Date,
  options: { onlyUserId?: string; source?: "cron" | "prova" } = {}
): Promise<DailyBriefingRunResult> {
  const result: DailyBriefingRunResult = { candidates: 0, enabled: 0, pushes: 0, emails: 0, empty: 0, ready: true };
  const { dateIso } = romeNow(now);

  let query = service
    .from("profiles")
    .select("id, full_name, email, notify_email, daily_briefing_push, daily_briefing_email")
    .or("daily_briefing_push.eq.true,daily_briefing_email.eq.true");
  if (options.onlyUserId) query = query.eq("id", options.onlyUserId);
  const { data, error } = await query;
  if (error) {
    result.ready = false; // colonne non ancora create
    return result;
  }
  const recipients = (data ?? []) as Recipient[];
  result.candidates = recipients.length;

  for (const r of recipients) {
    try {
      const on = await resolveFeatureFlag({ flagName: DAILY_BRIEFING_FLAG, userId: r.id, role: "parent", tenant: "family" }).catch(() => false);
      if (!on) continue;
      result.enabled++;
      const briefing = await briefingForParent(service, r.id, r.full_name, dateIso);
      if (briefing === "no-kids") {
        result.empty++;
        continue;
      }
      if (!briefing) {
        result.empty++;
        continue;
      }
      if (r.daily_briefing_push) {
        // 28/10/2026: la notifica apre la Home con il foglio "Il buongiorno"
        // (stesso contenuto dell'email); l'email continua a portare al Planner.
        await sendPushToUser(r.id, { title: briefing.title, body: briefing.body, deepLink: briefing.sheetLink, tag: briefing.tag });
        result.pushes++;
      }
      if (r.daily_briefing_email && r.email && r.notify_email !== false && isEmailConfigured) {
        const sent = await sendEmail({ to: r.email, subject: briefing.subject, html: briefing.html, text: briefing.text });
        if (!sent.error) result.emails++;
      }
    } catch (err) {
      console.error("[daily-briefing] genitore saltato:", err instanceof Error ? err.message : String(err));
    }
  }

  try {
    await service.from("product_events").insert({
      event_name: "daily_briefing_run",
      detail: `${options.source ?? "cron"} candidates=${result.candidates} enabled=${result.enabled} push=${result.pushes} email=${result.emails} empty=${result.empty}`,
    });
  } catch {
    // osservabilità best-effort
  }
  return result;
}
