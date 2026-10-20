import "server-only";

// TRAMA — ADMIN BETA COCKPIT · Avviso "report pronto" al founder. Nessun
// nuovo scheduler: gira nel cron del Buongiorno (app/api/cron/daily-briefing,
// alle 8 ora di Roma). Se secondo le impostazioni si è chiusa una finestra
// (giornaliera o settimanale) e l'avviso non è ancora partito, manda
// un'email con i numeri principali e il link al report. Un solo invio per
// finestra (product_events "beta_report_notice_sent", detail = chiave della
// finestra). Mai nomi di famiglie nell'email. Best effort: non lancia mai.

import { createServiceClient } from "@/lib/supabase/service";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { lastClosedWindow, rangeLabel, resolvePeriod } from "@/lib/beta-cockpit/dates";
import { buildCockpitView } from "@/lib/beta-cockpit/view";
import { kpiValueLabel } from "@/lib/beta-cockpit/model";
import { loadCockpitData, loadCockpitSettings } from "@/lib/data/beta-cockpit";
import { CANONICAL_ROOT_DOMAIN } from "@/lib/public-links";

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

    const { data: admins } = await service.from("profiles").select("email").eq("role", "platform_admin");
    const to = process.env.BETA_REPORT_EMAIL || (admins ?? []).map((a) => a.email as string | null).find(Boolean);
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
      },
      period,
      now
    );
    const link = `${ADMIN_ORIGIN}/admin/beta/report?p=custom&da=${win.from}&a=${win.to}`;
    const kpiLines = view.kpis.map((k) => `${k.label}: ${kpiValueLabel(k)}`);
    const subject = `TRAMA — Beta Report ${rangeLabel(win.from, win.to)}`;
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#172A4D;font-size:15px;line-height:1.5">
<p><b>Beta Report · ${esc(rangeLabel(win.from, win.to))}</b></p>
<p>${kpiLines.map(esc).join("<br>")}</p>
${view.summary.signals.length ? `<p><b>Segnali da guardare</b><br>${view.summary.signals.map(esc).join("<br>")}</p>` : ""}
<p><a href="${link}">Apri il report</a> (accesso Admin)</p></div>`;
    const text = [`Beta Report · ${rangeLabel(win.from, win.to)}`, "", ...kpiLines, "", ...view.summary.signals, "", link].join("\n");

    const r = await sendEmail({ to, subject, html, text });
    if (r.error) return { sent: false, reason: "invio non riuscito" };
    await service.from("product_events").insert({ event_name: "beta_report_notice_sent", detail: win.key, tenant: "admin" });
    return { sent: true };
  } catch {
    return { sent: false, reason: "errore" };
  }
}
