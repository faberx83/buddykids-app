// TRAMA — PERCORSO DEI CENTRI DEL PILOTA (27/10/2026): invio delle email di
// lib/centers/pilot-emails.ts. Tutto best-effort per costruzione: una
// prenotazione, una candidatura o un'approvazione già salvate non dipendono
// MAI dalla riuscita di un'email (stesso principio della push al centro in
// app/booking/[id]/actions.ts). Ogni funzione controlla da sé il flag
// CENTER_PILOT_FLOW_ENABLED: spento = nessuna email, come prima.

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import {
  CENTER_PILOT_FLOW_FLAG,
  PARTNER_PUBLIC_ORIGIN,
  candidacyAdminNoticeEmail,
  candidacyApprovedEmail,
  candidacyReceivedEmail,
  centerNewMessageEmail,
  centerNewRequestEmail,
} from "@/lib/centers/pilot-emails";

async function flagOn(userId: string | null, role: string | null): Promise<boolean> {
  return resolveFeatureFlag({ flagName: CENTER_PILOT_FLOW_FLAG, userId, role, tenant: "center" }).catch(() => false);
}

/** Avviso a TRAMA: casella dedicata se c'è, altrimenti quella della lista d'attesa. */
export function centerLeadsNotifyAddress(env: Record<string, string | undefined> = process.env): string | null {
  const v = (env.CENTER_LEADS_NOTIFY_EMAIL || env.WAITLIST_NOTIFY_EMAIL || "").trim();
  return v || null;
}

/** Nuova richiesta di una famiglia → email a ogni gestore del centro (flag risolto per gestore). */
export async function emailCenterAdminsOfNewRequest(input: {
  centerId: string;
  activityName: string | null;
  kids: number;
  days: number;
  weeks: number;
}): Promise<void> {
  if (!isEmailConfigured) return;
  try {
    const service = createServiceClient();
    if (!service) return;
    const { data: admins } = await service
      .from("profiles")
      .select("id, email")
      .eq("center_id", input.centerId)
      .eq("role", "center_admin");
    const mail = centerNewRequestEmail(input);
    for (const admin of admins ?? []) {
      if (!admin.email) continue;
      if (!(await flagOn(admin.id, "center_admin"))) continue;
      const r = await sendEmail({ to: admin.email, subject: mail.subject, html: mail.html });
      if (r.error) console.error(`[center-pilot] email nuova richiesta non inviata (center=${input.centerId}): ${r.error}`);
    }
  } catch (e) {
    console.error("[center-pilot] errore inatteso nell'email di nuova richiesta:", e);
  }
}

/** Nuovo messaggio di una famiglia → email a ogni gestore del centro (flag per gestore). */
export async function emailCenterAdminsOfNewMessage(input: {
  centerId: string;
  activityName: string | null;
  parentFirstName: string | null;
  preview: string;
  inquiryId: string;
}): Promise<void> {
  if (!isEmailConfigured) return;
  try {
    const service = createServiceClient();
    if (!service) return;
    const { data: admins } = await service
      .from("profiles")
      .select("id, email")
      .eq("center_id", input.centerId)
      .eq("role", "center_admin");
    const mail = centerNewMessageEmail(input);
    for (const admin of admins ?? []) {
      if (!admin.email) continue;
      if (!(await flagOn(admin.id, "center_admin"))) continue;
      const r = await sendEmail({ to: admin.email, subject: mail.subject, html: mail.html });
      if (r.error) console.error(`[center-pilot] email nuovo messaggio non inviata (center=${input.centerId}): ${r.error}`);
    }
  } catch (e) {
    console.error("[center-pilot] errore inatteso nell'email di nuovo messaggio:", e);
  }
}

/** Candidatura appena salvata → conferma al centro + avviso a TRAMA. */
export async function emailCandidacyReceived(input: {
  leadId: string;
  centerName: string;
  locality: string | null;
  email: string;
  phone: string | null;
  description: string | null;
  source?: string | null;
}): Promise<void> {
  if (!isEmailConfigured) return;
  try {
    if (!(await flagOn(null, null))) return;
    const toCenter = candidacyReceivedEmail({
      centerName: input.centerName,
      statusUrl: `${PARTNER_PUBLIC_ORIGIN}/auth/candidati/conferma/${input.leadId}`,
    });
    await sendEmail({ to: input.email, subject: toCenter.subject, html: toCenter.html }).catch(() => undefined);
    const notifyTo = centerLeadsNotifyAddress();
    if (notifyTo) {
      const notice = candidacyAdminNoticeEmail(input);
      await sendEmail({ to: notifyTo, subject: notice.subject, html: notice.html }).catch(() => undefined);
    }
  } catch (e) {
    console.error("[center-pilot] errore inatteso nelle email della candidatura:", e);
  }
}

/** Candidatura approvata → "sei dentro": entra (account già collegato) o crea l'accesso. */
export async function emailCandidacyApproved(input: {
  adminUserId: string | null;
  centerName: string;
  email: string;
  alreadyRegistered: boolean;
}): Promise<boolean> {
  if (!isEmailConfigured || !input.email.trim()) return false;
  try {
    if (!(await flagOn(input.adminUserId, "platform_admin"))) return false;
    const mail = candidacyApprovedEmail({
      centerName: input.centerName,
      email: input.email.trim(),
      alreadyRegistered: input.alreadyRegistered,
    });
    const r = await sendEmail({ to: input.email.trim(), subject: mail.subject, html: mail.html });
    if (r.error) console.error(`[center-pilot] email di approvazione non inviata: ${r.error}`);
    return !r.error;
  } catch (e) {
    console.error("[center-pilot] errore inatteso nell'email di approvazione:", e);
    return false;
  }
}
