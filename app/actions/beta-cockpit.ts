"use server";

// TRAMA — ADMIN BETA COCKPIT (20/10/2026). Azioni Admin del cockpit e le
// due azioni della survey per le famiglie. Ogni azione Admin rifà il
// controllo platform_admin lato server (requirePlatformAdmin): il layout
// Admin protegge solo la UI.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/data/beta-cockpit";
import { resolveThresholds, type CockpitThresholds } from "@/lib/beta-cockpit/definitions";
import { isIsoDate } from "@/lib/beta-cockpit/dates";
import { EXTENDED_STATUSES, isCockpitFeedbackStatus, parseTags, type CockpitFeedbackStatus } from "@/lib/beta-cockpit/feedback";
import { getSurvey, validateSurveyAnswers, type SurveyConfig } from "@/lib/beta-cockpit/survey";
import { isMissingColumnError } from "@/lib/nextgen/beta-feedback-shared";

const NOT_ADMIN = { error: "Solo l'Admin piattaforma" };
const NEEDS_MIGRATION = { error: "Serve la migration 46 (bash deploy.sh)" };

function revalidateCockpit() {
  revalidatePath("/admin/beta");
  revalidatePath("/admin/beta/report");
}

// ── Impostazioni ──────────────────────────────────────────────────────────

export interface CockpitSettingsInput {
  frequency: "manual" | "daily" | "weekly";
  weekday: number;
  time: string;
  betaStart: string;
  thresholds: Partial<CockpitThresholds>;
  surveyConfig: SurveyConfig;
}

export async function saveCockpitSettingsAction(input: CockpitSettingsInput): Promise<{ error?: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  if (!["manual", "daily", "weekly"].includes(input.frequency)) return { error: "Frequenza non valida" };
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) return { error: "Giorno non valido" };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return { error: "Ora non valida (HH:mm)" };
  if (!isIsoDate(input.betaStart)) return { error: "Data di inizio non valida" };
  const thresholds = resolveThresholds(input.thresholds);
  const { error } = await admin.supabase
    .from("beta_cockpit_settings")
    .update({
      report_frequency: input.frequency,
      report_weekday: input.weekday,
      report_time: input.time,
      beta_start_date: input.betaStart,
      thresholds,
      survey_config: input.surveyConfig,
      updated_by: admin.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return NEEDS_MIGRATION;
  revalidateCockpit();
  return {};
}

/** Esclude (o riammette) un account dai conteggi: founder, prove, persone che non fanno parte della beta. */
export async function setCockpitUserExcludedAction(userId: string, excluded: boolean): Promise<{ error?: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  const { data, error } = await admin.supabase.from("beta_cockpit_settings").select("excluded_user_ids").eq("id", 1).maybeSingle();
  if (error || !data) return NEEDS_MIGRATION;
  const current = new Set((data.excluded_user_ids as string[] | null) ?? []);
  if (excluded) current.add(userId);
  else current.delete(userId);
  const { error: upErr } = await admin.supabase
    .from("beta_cockpit_settings")
    .update({ excluded_user_ids: Array.from(current), updated_by: admin.userId, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (upErr) return { error: upErr.message };
  revalidateCockpit();
  return {};
}

// ── Famiglie invitate (riuso della lista d'attesa) ────────────────────────

/**
 * Segna una famiglia come invitata: una riga in beta_waitlist con stato
 * "invitato" (o aggiorna quella esistente). Quando si registra con la stessa
 * email il cockpit la collega da solo. L'etichetta è come la chiama il
 * founder ("Rossi — 3B Pascoli"): niente nomi dei figli.
 */
export async function addInvitedFamilyAction(input: { email: string; label: string }): Promise<{ error?: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  const email = input.email.trim().toLowerCase();
  const label = input.label.trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Email non valida" };
  const service = createServiceClient();
  if (!service) return { error: "Manca SUPABASE_SERVICE_ROLE_KEY" };
  const now = new Date().toISOString();
  const { data: existing } = await service.from("beta_waitlist").select("id, note").eq("email", email).maybeSingle();
  const { error } = existing
    ? await service
        .from("beta_waitlist")
        .update({ status: "invitato", invited_at: now, note: label || existing.note, updated_at: now })
        .eq("id", existing.id)
    : await service.from("beta_waitlist").insert({ email, note: label || null, source: "admin", status: "invitato", invited_at: now });
  if (error) return { error: error.message };
  revalidateCockpit();
  revalidatePath("/admin/lista-attesa");
  return {};
}

// ── Feedback ──────────────────────────────────────────────────────────────

export async function updateFeedbackTriageAction(
  id: string,
  input: { status: CockpitFeedbackStatus; tags: string[] | string; adminNote?: string | null }
): Promise<{ error?: string; tags?: string[] }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  if (!isCockpitFeedbackStatus(input.status)) return { error: "Stato non valido" };
  const tags = parseTags(input.tags);
  const base = { status: input.status, admin_note: input.adminNote?.trim() || null, updated_at: new Date().toISOString() };
  let { error } = await admin.supabase.from("beta_feedback").update({ ...base, admin_tags: tags }).eq("id", id);
  if (error && isMissingColumnError(error)) {
    if (EXTENDED_STATUSES.includes(input.status) || tags.length > 0) return NEEDS_MIGRATION;
    ({ error } = await admin.supabase.from("beta_feedback").update(base).eq("id", id));
  }
  if (error) return EXTENDED_STATUSES.includes(input.status) ? NEEDS_MIGRATION : { error: error.message };
  revalidateCockpit();
  revalidatePath("/admin/segnalazioni-beta");
  return { tags };
}

// ── Decision log ──────────────────────────────────────────────────────────

export interface DecisionInput {
  periodStart: string;
  periodEnd: string;
  observation: string;
  hypothesis?: string;
  decision?: string;
  action?: string;
  owner?: string;
  dueDate?: string | null;
}

export async function createDecisionAction(input: DecisionInput): Promise<{ error?: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  if (!isIsoDate(input.periodStart) || !isIsoDate(input.periodEnd)) return { error: "Periodo non valido" };
  const obs = input.observation.trim();
  if (!obs) return { error: "Scrivi almeno l'osservazione" };
  const clip = (s: string | undefined, n: number) => (s?.trim() ? s.trim().slice(0, n) : null);
  const { error } = await admin.supabase.from("beta_decisions").insert({
    period_start: input.periodStart <= input.periodEnd ? input.periodStart : input.periodEnd,
    period_end: input.periodStart <= input.periodEnd ? input.periodEnd : input.periodStart,
    observation: obs.slice(0, 1000),
    hypothesis: clip(input.hypothesis, 1000),
    decision: clip(input.decision, 1000),
    action: clip(input.action, 500),
    owner: clip(input.owner, 80),
    due_date: input.dueDate && isIsoDate(input.dueDate) ? input.dueDate : null,
    created_by: admin.userId,
  });
  if (error) return NEEDS_MIGRATION;
  revalidateCockpit();
  return {};
}

export async function setDecisionStatusAction(id: string, status: "aperta" | "fatta" | "annullata"): Promise<{ error?: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return NOT_ADMIN;
  if (!["aperta", "fatta", "annullata"].includes(status)) return { error: "Stato non valido" };
  const { error } = await admin.supabase.from("beta_decisions").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidateCockpit();
  return {};
}

// ── Survey (famiglie) ─────────────────────────────────────────────────────

/** Salva le risposte come un feedback (area = id della survey), con le risposte strutturate nel contesto. */
export async function submitBetaSurveyAction(surveyId: string, answers: Record<string, unknown>): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const survey = getSurvey(surveyId);
  if (!survey) return { error: "Survey sconosciuta" };
  const checked = validateSurveyAnswers(survey, answers);
  if (!checked.ok) return { error: checked.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };
  const { data: already } = await supabase.from("beta_feedback").select("id").eq("parent_id", user.id).eq("area", survey.id).limit(1);
  if (already && already.length > 0) return {};
  const { error } = await supabase.from("beta_feedback").insert({
    parent_id: user.id,
    app_source: "genitori",
    area: survey.id,
    page_path: "/nextgen",
    message: checked.message || survey.title,
    status: "nuovo",
    client_context: { survey: { id: survey.id, answers: checked.answers } },
  });
  if (error) return { error: "Non siamo riusciti a salvare: riprova tra poco" };
  revalidatePath("/nextgen");
  revalidateCockpit();
  return {};
}

/** "Più tardi": la survey torna dopo qualche giorno (announcement_receipts, come le Novità). */
export async function snoozeBetaSurveyAction(surveyId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !getSurvey(surveyId)) return {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const now = new Date().toISOString();
  await supabase
    .from("announcement_receipts")
    .upsert(
      { parent_id: user.id, announcement_id: surveyId, announcement_version: 1, seen_at: now, dismissed_at: now },
      { onConflict: "parent_id,announcement_id,announcement_version" }
    );
  revalidatePath("/nextgen");
  return {};
}
