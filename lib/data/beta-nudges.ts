import "server-only";

// TRAMA — SOLLECITI ALLE FAMIGLIE DELLA BETA (20/11/2026).
// Fabrizio: "dobbiamo definire una campagna di push per 'sollecitare' chi non
// si è iscritto" → "Registrati poco attivi" (push + email).
//
// Letture col client di servizio, solo dopo il controllo Admin del chiamante
// (app/actions/beta-nudges.ts e pagina Beta Famiglie). Destinatari ricavati
// dalla stessa CockpitView del Beta cockpit (lib/beta-cockpit/nudges.ts).
// Invio best-effort: un errore su una persona non ferma le altre.

import { createServiceClient } from "@/lib/supabase/service";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push/send";
import { CANONICAL_FAMILY_ORIGIN } from "@/lib/public-links";
import { loadCockpitData, loadCockpitSettings } from "@/lib/data/beta-cockpit";
import { loadTestAccountIds } from "@/lib/admin-alerts/send";
import { buildCockpitView, type CockpitView } from "@/lib/beta-cockpit/view";
import { resolvePeriod, romeDay } from "@/lib/beta-cockpit/dates";
import {
  NUDGE_CAMPAIGNS,
  NUDGE_SENT_EVENT,
  familiesForCampaign,
  nudgeByKey,
  nudgeDedupeKey,
  nudgeEmailHtml,
  nudgeEmailText,
  selectNudgeRecipients,
  type NudgeCampaign,
  type NudgeKey,
} from "@/lib/beta-cockpit/nudges";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

export interface NudgeOverviewRow {
  key: NudgeKey;
  audience: string;
  push: NudgeCampaign["push"];
  families: number;
  /** Persone che lo riceverebbero ora (senza prove e senza chi l'ha avuto da meno di 7 giorni). */
  recipients: number;
  skippedCooldown: number;
  lastSentAt: string | null;
}

async function loadContext(service: Service, now: Date) {
  const settings = await loadCockpitSettings(service);
  const data = await loadCockpitData(service, null, now);
  const todayIso = romeDay(now);
  const period = resolvePeriod("7g", todayIso, settings.betaStart);
  const view: CockpitView = buildCockpitView(
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
  const membersByFamily = new Map<string, string[]>(data.raw.families.map((f) => [f.key, f.members.map((m) => m.userId)]));
  const testUserIds = await loadTestAccountIds(service);
  return { view, membersByFamily, testUserIds };
}

async function lastSentByUser(service: Service, key: NudgeKey): Promise<Map<string, string>> {
  const { data } = await service
    .from("product_events")
    .select("detail, created_at")
    .eq("event_name", NUDGE_SENT_EVENT)
    .like("detail", `${key}:%`)
    .order("created_at", { ascending: false })
    .limit(5000);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { detail: string | null; created_at: string }[]) {
    const userId = row.detail?.slice(key.length + 1);
    if (userId && !map.has(userId)) map.set(userId, row.created_at);
  }
  return map;
}

export async function loadNudgeOverview(now: Date = new Date()): Promise<NudgeOverviewRow[] | null> {
  const service = createServiceClient();
  if (!service) return null;
  try {
    const ctx = await loadContext(service, now);
    return await Promise.all(
      NUDGE_CAMPAIGNS.map(async (c) => {
        const familyKeys = familiesForCampaign(c, ctx.view.frictionMap, ctx.view.alerts);
        const sent = await lastSentByUser(service, c.key);
        const { recipients, skippedCooldown } = selectNudgeRecipients({
          familyKeys,
          membersByFamily: ctx.membersByFamily,
          testUserIds: ctx.testUserIds,
          lastSentByUser: sent,
          now,
        });
        const last = Array.from(sent.values()).sort().pop() ?? null;
        return { key: c.key, audience: c.audience, push: c.push, families: familyKeys.length, recipients: recipients.length, skippedCooldown, lastSentAt: last };
      })
    );
  } catch {
    return null;
  }
}

export interface NudgeSendResult {
  people: number;
  emails: number;
  skippedCooldown: number;
}

/** Invia un sollecito: push a tutti i destinatari (se hanno le push accese), email a chi le ha accese. */
export async function sendNudgeCampaign(key: string, now: Date = new Date()): Promise<NudgeSendResult | { error: string }> {
  const campaign = nudgeByKey(key);
  if (!campaign) return { error: "Sollecito sconosciuto." };
  const service = createServiceClient();
  if (!service) return { error: "Servizio non disponibile." };

  const ctx = await loadContext(service, now);
  const familyKeys = familiesForCampaign(campaign, ctx.view.frictionMap, ctx.view.alerts);
  const { recipients, skippedCooldown } = selectNudgeRecipients({
    familyKeys,
    membersByFamily: ctx.membersByFamily,
    testUserIds: ctx.testUserIds,
    lastSentByUser: await lastSentByUser(service, campaign.key),
    now,
  });
  if (recipients.length === 0) return { people: 0, emails: 0, skippedCooldown };

  const { data: profiles } = await service
    .from("profiles")
    .select("id, email, full_name, notify_email, role")
    .in(
      "id",
      recipients.map((r) => r.userId)
    );
  const byId = new Map(
    ((profiles ?? []) as { id: string; email: string | null; full_name: string | null; notify_email: boolean | null; role: string | null }[]).map((p) => [p.id, p])
  );

  const link = `${CANONICAL_FAMILY_ORIGIN}${campaign.push.deepLink}`;
  let emails = 0;
  let people = 0;
  for (const r of recipients) {
    const p = byId.get(r.userId);
    if (!p || p.role !== "parent") continue; // solo genitori
    people += 1;
    // Prima la registrazione: un secondo clic non manda due volte.
    await service.from("product_events").insert({ event_name: NUDGE_SENT_EVENT, detail: nudgeDedupeKey(campaign.key, r.userId), tenant: "admin" });
    await sendPushToUser(r.userId, { ...campaign.push, tag: `nudge-${campaign.key}` });
    if (isEmailConfigured && p.email && p.notify_email !== false) {
      const firstName = (p.full_name ?? "").trim().split(" ")[0] || null;
      const res = await sendEmail({
        to: p.email,
        subject: campaign.email.subject,
        html: nudgeEmailHtml(campaign, link, firstName),
        text: nudgeEmailText(campaign, link, firstName),
      });
      if (!res.error) emails += 1;
    }
  }
  return { people, emails, skippedCooldown };
}
