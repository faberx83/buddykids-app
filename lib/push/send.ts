import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

// TRAMA — Push notifications (31/08/2026), disegnate nel report "PUSH
// NOTIFICATIONS — MIGRATION REQUIRED", implementate dopo l'applicazione di
// supabase/migration_31_push_subscriptions.sql (verificata live via MCP
// Supabase read-only prima di scrivere questo file).
//
// Payload minimale (title/body/deepLink) — STESSA disciplina privacy-first
// già seguita per NotificationItem (lib/notifications/model.ts): niente
// email/telefono/nomi bambini/testi liberi del richiedente nel payload push,
// che il sistema operativo può mostrare anche a schermo bloccato.
export interface PushPayload {
  title: string;
  body: string;
  deepLink: string;
}

// createServiceClient() (lib/supabase/service.ts, Wave 1) — STESSO client
// service-role già usato per l'osservabilità Admin: qui serve per lo stesso
// identico motivo, leggere subscription di UN UTENTE DIVERSO dal chiamante
// (chi accetta un invito/prenotazione non è il destinatario della push).
// RLS su push_subscriptions permette a un utente solo le PROPRIE righe
// (vedi migration_31): un client con la sessione del chiamante non potrebbe
// mai leggere le subscription del destinatario, per costruzione — da qui la
// necessità del service client, non una scelta di comodo.
let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// Best-effort per costruzione (mai lanciata un'eccezione verso il
// chiamante): stesso principio già stabilito per l'invio email nelle
// action esistenti (es. notifyParentOfBookingResponse in
// app/actions/booking-response.ts) — una push fallita/non configurata non
// deve MAI far fallire l'azione di dominio che la genera (accettare un
// invito, rispondere a una prenotazione, ecc. devono riuscire comunque).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureVapidConfigured()) return; // VAPID non configurato (locale/preview senza chiavi) — no-op silenzioso
    const service = createServiceClient();
    if (!service) return; // Supabase non configurato o service key assente

    // FIX (TRAMA FINAL HARDENING §9, root cause audit) — profiles.notify_push
    // esiste da tempo (impostazioni Notifiche, lib/data/profile.ts) ma non
    // era MAI letto qui: nessuno dei 6 punti di invio esistenti
    // (booking-response.ts, booking/[id]/actions.ts, inquiries.ts x2,
    // groups.ts x2, travel-reminders cron) verificava la preferenza —
    // notify_push=false non impediva alcuna push. Centralizzato QUI (unico
    // punto di invio reale, webpush.sendNotification) invece che in ognuno
    // dei chiamanti: ogni punto di invio ATTUALE e FUTURO rispetta
    // automaticamente la preferenza, senza dover ricordare di controllarla
    // ogni volta. Default true (stesso default già usato da
    // getProfile/lib/data/profile.ts, notify_push null = non ancora
    // impostato esplicitamente) — SOLO false disattiva davvero.
    const { data: profile } = await service.from("profiles").select("notify_push").eq("id", userId).maybeSingle();
    if (profile && profile.notify_push === false) return; // preferenza esplicita: nessuna push, punto.

    const { data: subs, error } = await service
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error || !subs || subs.length === 0) return; // nessun device iscritto: normale, non un errore

    const json = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
          await service.from("push_subscriptions").update({ last_seen_at: new Date().toISOString() }).eq("id", sub.id);
        } catch (err) {
          const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription scaduta/revocata dal browser (permesso ritirato,
            // dati del sito cancellati, ecc.) — self-cleaning: nessun job
            // cron dedicato necessario, la riga sparisce al primo tentativo
            // di invio fallito.
            await service.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error(`[push] invio fallito per subscription ${sub.id} (userId=${userId}):`, err);
          }
        }
      })
    );
  } catch (err) {
    console.error(`[push] sendPushToUser fallita per userId=${userId}:`, err);
  }
}
