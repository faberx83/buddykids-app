import "server-only";

// TRAMA — ADMIN BETA COCKPIT · Avviso "report pronto" al founder. Nessun
// nuovo scheduler: gira nel cron del Buongiorno (app/api/cron/daily-briefing,
// alle 7 ora di Roma). Se secondo le impostazioni si è chiusa una finestra
// (giornaliera o settimanale) e l'avviso non è ancora partito, manda
// un'email con i numeri principali e il link al report. Un solo invio per
// finestra (product_events "beta_report_notice_sent", detail = chiave della
// finestra). Mai nomi di famiglie nell'email. Best effort: non lancia mai.

import { createServiceClient } from "@/lib/supabase/service";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { lastClosedWindow, rangeLabel, resolvePeriod } from "@/lib/beta-cockpit/dates";
import { buildCockpitView } from "@/lib/beta-cockpit/view";
// 20/11/2026: contenuto dettagliato (grafici, motivi, azioni) in lib/beta-cockpit/report-email.ts.
import { buildBetaReportEmail } from "@/lib/beta-cockpit/report-email";
import { loadCockpitData, loadCockpitSettings } from "@/lib/data/beta-cockpit";
import { CANONICAL_ROOT_DOMAIN } from "@/lib/public-links";
import { countActivitySince, loadTestAccountIds } from "@/lib/admin-alerts/send";
import { weeklyActivityLines } from "@/lib/admin-alerts/messages";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

// Portale Admin (proxy.ts: sul dominio admin.* i percorsi /admin/... passano invariati).
const ADMIN_ORIGIN = `https://admin.${CANONICAL_ROOT_DOMAIN}`;

export async function sendBetaReportNoticeIfDue(service: Service, now: Date): Promise<{ sent: boolean; reason?: string }> {
  try {
    const settings = await loadCockpitSettings(service);
    if (!settings.tableReady) return { sent: false, reason: "migration 46 non applicata" };
    if (settings.frequency === "manual") return { sent: false, reason: "manuale" };
    const win = lastClosedWindow({ frequency: settings.frequency, weekday: settings.weekday, time: settings.time, betaStart: settings.betaStart }, now);
    if (!win) return { sent: false, reason: "nessuna finestra chiusa" };

    const already = await service
      .from("product_events")
      .select("id", { head: true, count: "exact" })
      .eq("event_name", "beta_report_notice_sent")
      .eq("detail", win.key);
    if ((already.count ?? 0) > 0) return { sent: false, reason: "già inviato" };

    // 20/11/2026: l'Admin può spegnere l'email dal suo profilo (Admin → Le mie
    // notifiche, profiles.notify_email, come per genitori e centri).
    const { data: admins } = await service.from("profiles").select("email, notify_email").eq("role", "platform_admin");
    const adminRows = (admins ?? []) as { email: string | null; notify_email: boolean | null }[];
    if (adminRows.length > 0 && adminRows.every((a) => a.notify_email === false)) return { sent: false, reason: "email spenta dal profilo Admin" };
    const to = process.env.BETA_REPORT_EMAIL || adminRows.filter((a) => a.notify_email !== false).map((a) => a.email).find(Boolean);
    if (!to || !isEmailConfigured) return { sent: false, reason: "email non configurata" };

    const data = await loadCockpitData(service, null, now);
    const period = resolvePeriod("custom", win.to, settings.betaStart, { from: win.from, to: win.to });
    const view = buildCockpitView(
      {
        raw: data.raw,
        feedback: data.feedback,
        surveyResponses: data.surveyResponses,
        demandSignals: data.demandSignals,
        zonesByFamily: data.zonesByFamily,
        thresholds: settings.thresholds,
        betaStart: settings.betaStart,
        // 20/11/2026: anche i passaggi prima della registrazione (visite, richieste, clic).
        preRegistration: data.preRegistration,
      },
      period,
      now
    );
    const link = `${ADMIN_ORIGIN}/admin/beta/report?p=custom&da=${win.from}&a=${win.to}`;
    const weekSince = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const weekLines = weeklyActivityLines(await countActivitySince(service, weekSince, await loadTestAccountIds(service)));
    // 20/11/2026 — Fabrizio: "Email da TRAMA con report dettagliato grafici motivi e azioni".
    const { subject, html, text } = buildBetaReportEmail({ view, rangeLabel: rangeLabel(win.from, win.to), link, weekLines });

    const r = await sendEmail({ to, subject, html, text });
    if (r.error) return { sent: false, reason: "invio non riuscito" };
    await service.from("product_events").insert({ event_name: "beta_report_notice_sent", detail: win.key, tenant: "admin" });
    return { sent: true };
  } catch {
    return { sent: false, reason: "errore" };
  }
}
