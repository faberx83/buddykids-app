import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPendingCheckinsForPushToday } from "@/lib/data/checkin";
import { sendPushToUser } from "@/lib/push/send";
import { logTelemetryEvent } from "@/lib/telemetry/correlation";

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
// vincolo già scoperto per travel-reminders — vedi commento lì). "30 5 * * *"
// UTC = le 7:30 in Europe/Rome (ora legale estiva) — orario richiesto da
// Fabrizio il 09/09/2026 (in precedenza "0 8 * * *"/le 10:00, dopo il
// tipico ingresso mattutino: con l'orario più anticipato la domanda "è
// arrivato/a?" può ora precedere la risposta reale per alcuni bambini,
// scelta esplicita di Fabrizio, non un difetto). Vercel non garantisce il
// minuto esatto di esecuzione. Il cron è un orario UTC fisso: NON segue
// automaticamente il cambio ora legale/solare — a ora solare (CET, UTC+1)
// "30 5" corrisponde alle 6:30 locali, non alle 7:30 (stesso limite già
// presente prima di questo cambio, solo con offset diverso).
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
    // FIX (segnalazione Fabrizio 08/09/2026, "clicco la notifica e non mi
    // apre l'app installata ma la pagina web"): deepLink era "/" (radice,
    // scope Legacy), mentre TUTTE le altre push lato genitore in questo
    // codebase (prenotazioni, gruppi, inviti — vedi app/actions/groups.ts,
    // app/actions/booking-response.ts, lib/data/notifications.ts) puntano a
    // "/nextgen/...". public/manifest-nextgen.json dichiara "scope":
    // "/nextgen": un URL fuori da quello scope non viene riconosciuto da
    // Android/Chrome come "dentro" la PWA NextGen installata, quindi
    // self.clients.openWindow() (sw.js) apre una scheda browser normale
    // invece di rilanciare l'app in modalità standalone. NextgenCheckinCard
    // (app/nextgen/HomeDashboardClient.tsx) mostra lo stesso identico
    // prompt di check-in di CheckinPrompt.tsx (Legacy) — "/nextgen" è quindi
    // una destinazione equivalente, non un cambio di funzionalità.
    await sendPushToUser(parentId, {
      title: "Check-in di oggi",
      body,
      deepLink: "/nextgen",
    });
    sent++;
  }

  // OSSERVABILITÀ CRON (fix segnalazione Fabrizio 07/09/2026 — vedi commento
  // in lib/telemetry/known-events.ts su "checkin_push_cron_run"). Scrittura
  // DIRETTA via client di servizio: persistProductEvent() normale richiede
  // una sessione utente autenticata (auth.getUser()), che qui non esiste —
  // questo endpoint gira come cron, non come richiesta di un utente loggato.
  // Solo un conteggio aggregato per esecuzione, MAI parentId/kidId (stesso
  // vincolo "no PII" di TELEMETRY_FORBIDDEN_FIELDS in
  // lib/telemetry/correlation.ts) — permette di verificare da Supabase, senza
  // accesso alla dashboard Vercel, se/quando il cron è girato oggi e quante
  // push ha inviato. Fallita silenziosamente (solo log) per non far fallire
  // l'invio delle push reali se questo insert avesse un problema.
  try {
    await service.from("product_events").insert({
      event_name: "checkin_push_cron_run",
      detail: `pending=${pending.length} parents=${byParent.size} sent=${sent}`,
    });
  } catch (err) {
    logTelemetryEvent({
      event: "checkin_push_cron_run",
      detail: `insert fallito: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return NextResponse.json({ ok: true, pendingItems: pending.length, parentsNotified: sent });
}
