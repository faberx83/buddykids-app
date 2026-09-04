import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPendingCheckinsForPushToday } from "@/lib/data/checkin";
import { sendPushToUser } from "@/lib/push/send";

// TRAMA FINAL HARDENING §13-15 (push check-in, 04/09/2026) — promemoria
// "conferma l'arrivo di oggi" per i genitori che non hanno ancora risposto
// alla card di check-in (vedi components/CheckinPrompt.tsx). Endpoint
// chiamato SOLO dal cron di Vercel (vercel.json), MAI dal browser — stesso
// identico schema di protezione/logging di app/api/cron/travel-reminders.
//
// PERCHÉ UN CRON QUI (a differenza di lib/notifications/availability-push.ts,
// che è deliberatamente event-driven): "è il momento di chiedere se il
// bambino è arrivato" non è legato a nessuna scrittura di dominio — non
// esiste un evento naturale a cui agganciarsi (a differenza del rilascio di
// capacità per la disponibilità). Un cron a orario fisso è l'unica scelta
// sensata, stesso principio già applicato ai promemoria di partenza.
//
// ORARIO: una sola esecuzione/giorno (limite piano Vercel Hobby, stesso
// vincolo già scoperto per travel-reminders — vedi commento lì). "0 8 * * *"
// UTC = le 10:00 circa in Europe/Rome (ora legale estiva) — dopo il tipico
// orario di ingresso mattutino dei centri estivi, così la domanda "è
// arrivato/a?" arriva quando la risposta è già nota, non prima. Come per
// travel-reminders, Vercel non garantisce il minuto esatto di esecuzione.
//
// NESSUNA nuova regola di "chi va avvisato oggi": getPendingCheckinsForPushToday
// (lib/data/checkin.ts) riusa la STESSA query/filtro già in produzione per
// la card Home (partner_decision accepted, data odierna, non ancora
// risposto) — vedi commento esteso lì per deduplica e audit lato Partner
// (nessuna push Partner: "in ritardo" è già notificato via email, presente/
// assente non richiedono mai un'azione del centro).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

  const pending = await getPendingCheckinsForPushToday(service);

  // Un genitore con più bambini/attività ancora da confermare oggi riceve
  // UNA sola push cumulativa, mai una per ogni bambino — stesso principio
  // "no spam" già seguito per le altre push di questa app (una per evento
  // rilevante, non una per ogni riga di dati coinvolta).
  const byParent = new Map<string, typeof pending>();
  for (const item of pending) {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  }

  let sent = 0;
  for (const [parentId, items] of byParent) {
    const body =
      items.length === 1
        ? `${items[0].kidName} è arrivato/a a ${items[0].activityName}?`
        : `Conferma l'arrivo di ${items.length} bambini alle attività di oggi.`;
    await sendPushToUser(parentId, {
      title: "Check-in di oggi",
      body,
      deepLink: "/",
    });
    sent++;
  }

  return NextResponse.json({ ok: true, pendingItems: pending.length, parentsNotified: sent });
}
