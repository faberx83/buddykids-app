import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getActiveTravelReminders, parentHasActivityToday, markTravelReminderSent } from "@/lib/data/travel-reminders";
import { isReminderDue } from "@/lib/travel-reminders/trigger";
import { sendPushToUser } from "@/lib/push/send";
import { ADDRESS_KIND_LABELS, AddressKind } from "@/lib/nextgen/address-kinds";

// Promemoria di partenza — endpoint chiamato dal cron di Vercel (vedi
// vercel.json, "*/15 * * * *"), MAI dal browser. Segnalazione Fabrizio
// 03/09/2026: "possiamo attivare i reminder ora che ci sono le
// notifiche?" — vedi supabase/migration_36_travel_reminders.sql per il
// contesto completo e lo scope ridotto per la beta (orario impostato dal
// genitore, non calcolato da un tempo di percorrenza reale).
//
// Protetto da CRON_SECRET (stesso principio del secret condiviso già usato
// in app/internal/deploy-notify/route.ts, qui nella forma standard
// raccomandata da Vercel per i Cron Jobs: header "Authorization: Bearer
// $CRON_SECRET", che Vercel invia da solo alle chiamate cron SE la
// variabile d'ambiente CRON_SECRET è impostata sul progetto — va
// configurata da Fabrizio prima che questo endpoint sia utilizzabile).
//
// Finché supabase/migration_36_travel_reminders.sql non è applicata:
// getActiveTravelReminders() ritorna [] (query su tabella inesistente ->
// errore PostgREST -> array vuoto, mai un crash) — l'endpoint risponde
// comunque 200 con "processed: 0", nessun comportamento distruttivo se
// Vercel prova a chiamarlo prima che la migration sia pronta.

const TOLERANCE_MINUTES = 20; // >= intervallo del cron (15 min) + margine

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// "Ora" in Europe/Rome, indipendentemente dal fuso orario del server
// (le funzioni Vercel girano in UTC) — Intl invece di un calcolo manuale
// dell'offset, che si romperebbe con l'ora legale/solare.
function nowHHMMInRome(): { hhmm: string; dateIso: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    hhmm: `${get("hour")}:${get("minute")}`,
    dateIso: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected || !timingSafeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  const { hhmm, dateIso } = nowHHMMInRome();
  const reminders = await getActiveTravelReminders();

  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedNotDue = 0;
  let skippedNoActivityToday = 0;

  for (const reminder of reminders) {
    if (reminder.lastSentDate === dateIso) {
      skippedAlreadySent++;
      continue;
    }
    if (!isReminderDue(hhmm, reminder.targetTime, reminder.alarmMinutes, TOLERANCE_MINUTES)) {
      skippedNotDue++;
      continue;
    }
    // Mai avvisare "è ora di partire" in un giorno in cui il genitore non
    // ha nessuna attività reale prenotata — la stessa logica di
    // "coordination gap"/check-in di oggi già seguita altrove nel progetto:
    // un promemoria non legato a nulla di reale sarebbe solo rumore.
    const hasActivity = await parentHasActivityToday(service, reminder.parentId, dateIso);
    if (!hasActivity) {
      skippedNoActivityToday++;
      continue;
    }

    const originLabel = reminder.originKind ? ADDRESS_KIND_LABELS[reminder.originKind as AddressKind] : null;
    await sendPushToUser(reminder.parentId, {
      title: "È quasi ora di partire",
      body: originLabel
        ? `Ricordati di partire da ${originLabel} per essere puntuale.`
        : "Ricordati di partire per essere puntuale.",
      deepLink: "/nextgen",
    });
    await markTravelReminderSent(service, reminder.id, dateIso);
    sent++;
  }

  return NextResponse.json({
    ok: true,
    processed: reminders.length,
    sent,
    skippedAlreadySent,
    skippedNotDue,
    skippedNoActivityToday,
  });
}
