import "server-only";
// TRAMA — Avvisi Admin per la beta (20/11/2026).
// Richiesta di Fabrizio: "Attiva notifiche per nuovi utenti che entrano,
// segnalazioni, qualsiasi cosa utile per la fase beta."
// Iniziativa: claude/INIZIATIVA_avvisi_admin_beta.md (Project).
//
// REUSE: push con sendPushToUser (lib/push/send.ts, rispetta notify_push),
// email con sendEmail (lib/email.ts, Resend già configurato), destinatari =
// tutti i platform_admin; email a ADMIN_ALERTS_EMAIL, altrimenti
// WAITLIST_NOTIFY_EMAIL (già impostata su Vercel). Account di prova esclusi
// (lista "Account di prova", beta_cockpit_settings.excluded_user_ids).
// Un fatto avvisa una volta sola (product_events "admin_alert_sent",
// detail = chiave). Interruttore: ADMIN_ALERTS=off su Vercel.
// Best effort: non lancia mai, non blocca mai l'azione che lo chiama.

import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push/send";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { CANONICAL_ROOT_DOMAIN } from "@/lib/public-links";
import { buildAlertMessage, buildDailyDigest, isAlertFromTestAccount, type AdminAlert } from "./messages";

const ADMIN_ORIGIN = `https://admin.${CANONICAL_ROOT_DOMAIN}`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function adminAlertsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ADMIN_ALERTS ?? "").trim().toLowerCase() !== "off";
}

export async function notifyAdmins(alert: AdminAlert): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!adminAlertsEnabled()) return { sent: false, reason: "spenti (ADMIN_ALERTS=off)" };
    const service = createServiceClient();
    if (!service) return { sent: false, reason: "service client assente" };

    const { data: settings } = await service.from("beta_cockpit_settings").select("excluded_user_ids").eq("id", 1).maybeSingle();
    const testIds = new Set(((settings as { excluded_user_ids?: string[] | null } | null)?.excluded_user_ids ?? []).filter(Boolean));
    if (isAlertFromTestAccount(alert, testIds)) return { sent: false, reason: "account di prova" };

    const msg = buildAlertMessage(alert, ADMIN_ORIGIN);
    if (msg.dedupeKey) {
      const { count } = await service
        .from("product_events")
        .select("id", { head: true, count: "exact" })
        .eq("event_name", "admin_alert_sent")
        .eq("detail", msg.dedupeKey);
      if ((count ?? 0) > 0) return { sent: false, reason: "già avvisato" };
      await service.from("product_events").insert({ event_name: "admin_alert_sent", detail: msg.dedupeKey, tenant: "admin" });
    }

    const { data: admins } = await service.from("profiles").select("id, email").eq("role", "platform_admin");
    const adminRows = (admins ?? []) as { id: string; email: string | null }[];
    await Promise.all(adminRows.map((a) => sendPushToUser(a.id, msg.push)));

    if (msg.email && isEmailConfigured) {
      const to = (process.env.ADMIN_ALERTS_EMAIL || process.env.WAITLIST_NOTIFY_EMAIL || adminRows.find((a) => a.email)?.email || "").trim();
      if (to) {
        await sendEmail({
          to,
          subject: msg.email.subject,
          text: msg.email.text,
          html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(msg.email.text)}</pre>`,
        });
      }
    }
    return { sent: true };
  } catch (e) {
    console.error("[admin-alerts] avviso non inviato:", e);
    return { sent: false, reason: "errore" };
  }
}

/** Account creato da meno di questo tempo: è un ingresso nuovo, non un login qualsiasi. */
export const NEW_ACCOUNT_WINDOW_MS = 48 * 3600 * 1000;

export function isRecentAccount(createdAt: string | null | undefined, now: Date): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return !Number.isNaN(t) && now.getTime() - t <= NEW_ACCOUNT_WINDOW_MS && now.getTime() >= t - 60_000;
}

/**
 * Chiamata dal ritorno della conferma email (app/auth/callback): se l'account
 * è nuovo, avvisa una volta sola. I login successivi (link di accesso,
 * reset password) hanno l'account vecchio o la chiave già usata: nessun avviso.
 */
export async function alertNewAccountIfRecent(userId: string, now: Date = new Date()): Promise<void> {
  try {
    const service = createServiceClient();
    if (!service) return;
    const { data: p } = await service
      .from("profiles")
      .select("id, role, email, created_at, beta_invited_by_code")
      .eq("id", userId)
      .maybeSingle();
    const profile = p as { id: string; role: string | null; email: string | null; created_at: string | null; beta_invited_by_code: string | null } | null;
    if (!profile || !isRecentAccount(profile.created_at, now)) return;
    const { count } = await service
      .from("beta_cohort_memberships")
      .select("user_id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("active", true);
    let confirmed = true;
    try {
      const { data: authUser } = await service.auth.admin.getUserById(userId);
      confirmed = Boolean(authUser?.user?.email_confirmed_at);
    } catch {
      // se non leggibile, lo si tratta come confermato (nessun falso allarme)
    }
    await notifyAdmins({
      kind: "new_account",
      userId,
      role: profile.role ?? "parent",
      email: profile.email,
      betaCode: profile.beta_invited_by_code,
      inBeta: (count ?? 0) > 0,
      confirmed,
    });
  } catch (e) {
    console.error("[admin-alerts] nuovo account non segnalato:", e);
  }
}

/**
 * Cron delle 7 (app/api/cron/daily-briefing): 1) recupera gli account nuovi
 * non ancora segnalati (es. conferma email aperta su un altro dispositivo:
 * il ritorno non passa dal nostro callback); 2) riepilogo delle ultime 24 ore
 * agli Admin, solo se è successo qualcosa. Un riepilogo al giorno
 * (product_events "admin_alert_sent", detail "digest:<data>").
 */
export async function runAdminDailyAlerts(now: Date = new Date()): Promise<{ checkedNewAccounts: number; digest: boolean; reason?: string }> {
  try {
    if (!adminAlertsEnabled()) return { checkedNewAccounts: 0, digest: false, reason: "spenti" };
    const service = createServiceClient();
    if (!service) return { checkedNewAccounts: 0, digest: false, reason: "service client assente" };
    const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const windowStart = new Date(now.getTime() - NEW_ACCOUNT_WINDOW_MS).toISOString();

    const { data: settings } = await service.from("beta_cockpit_settings").select("excluded_user_ids").eq("id", 1).maybeSingle();
    const testIds = new Set(((settings as { excluded_user_ids?: string[] | null } | null)?.excluded_user_ids ?? []).filter(Boolean));
    const real = <T extends { id?: string; parent_id?: string | null }>(rows: T[] | null, key: "id" | "parent_id") =>
      (rows ?? []).filter((r) => {
        const v = (r as Record<string, unknown>)[key] as string | null | undefined;
        return !(v && testIds.has(v));
      });

    const { data: recent } = await service.from("profiles").select("id, created_at").gte("created_at", windowStart);
    let checkedNewAccounts = 0;
    for (const p of (recent ?? []) as { id: string; created_at: string }[]) {
      if (testIds.has(p.id)) continue;
      await alertNewAccountIfRecent(p.id, now);
      checkedNewAccounts++;
    }

    const day = now.toISOString().slice(0, 10);
    const { count: already } = await service
      .from("product_events")
      .select("id", { head: true, count: "exact" })
      .eq("event_name", "admin_alert_sent")
      .eq("detail", `digest:${day}`);
    if ((already ?? 0) > 0) return { checkedNewAccounts, digest: false, reason: "già inviato" };

    const [acc, fb, bk, inq, wl] = await Promise.all([
      service.from("profiles").select("id").gte("created_at", since),
      service.from("beta_feedback").select("parent_id").gte("created_at", since),
      service.from("bookings").select("parent_id").gte("created_at", since),
      service.from("activity_inquiries").select("parent_id").gte("created_at", since),
      service.from("beta_waitlist").select("id").gte("created_at", since),
    ]);
    const digest = buildDailyDigest(
      {
        newAccounts: real(acc.data as { id: string }[] | null, "id").length,
        feedback: real(fb.data as { parent_id: string | null }[] | null, "parent_id").length,
        bookings: real(bk.data as { parent_id: string | null }[] | null, "parent_id").length,
        inquiries: real(inq.data as { parent_id: string | null }[] | null, "parent_id").length,
        waitlist: (wl.data ?? []).length,
      },
      ADMIN_ORIGIN
    );
    if (!digest) return { checkedNewAccounts, digest: false, reason: "niente da segnalare" };
    await service.from("product_events").insert({ event_name: "admin_alert_sent", detail: `digest:${day}`, tenant: "admin" });

    const { data: admins } = await service.from("profiles").select("id, email").eq("role", "platform_admin");
    const adminRows = (admins ?? []) as { id: string; email: string | null }[];
    await Promise.all(adminRows.map((a) => sendPushToUser(a.id, digest.push)));
    const to = (process.env.ADMIN_ALERTS_EMAIL || process.env.WAITLIST_NOTIFY_EMAIL || adminRows.find((a) => a.email)?.email || "").trim();
    if (to && isEmailConfigured) {
      await sendEmail({
        to,
        subject: digest.email.subject,
        text: digest.email.text,
        html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(digest.email.text)}</pre>`,
      });
    }
    return { checkedNewAccounts, digest: true };
  } catch (e) {
    console.error("[admin-alerts] giro delle 7 non completato:", e);
    return { checkedNewAccounts: 0, digest: false, reason: "errore" };
  }
}
