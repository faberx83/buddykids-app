import "server-only";

// TRAMA — ADMIN BETA COCKPIT (20/10/2026). Lettura dei dati della beta
// famiglie, SOLO per l'Admin piattaforma. Nessuna tabella nuova per i
// comportamenti: tutto è derivato da tabelle operative già esistenti (vedi
// docs/trama-one/claude/INIZIATIVA_admin_beta_cockpit.md, sezione B).
//
// CHI LEGGE COSA:
//  - Prima di qualunque query, getBetaCockpitData() verifica lato server che
//    l'utente sia autenticato E platform_admin (il controllo del layout Admin
//    è solo lato client: stesso principio di lib/data/pilot-users.ts).
//  - Molte tabelle di famiglia non hanno un bypass admin nella RLS
//    (families, family_members, week_responsibilities, plan_shares,
//    push_subscriptions, group_members…): dopo il controllo si legge col
//    client di servizio, solo in lettura, solo le colonne necessarie (mai
//    nomi dei figli, note, indirizzi, testi degli impegni oltre al nome del
//    centro per la densità).
//  - "App aperta" passa dalla funzione admin_beta_open_days() (migration 46)
//    col client di SESSIONE: la funzione stessa rifiuta chi non è admin.
//
// Popolazione beta: genitori della coorte trama-one-controlled-beta e gli
// altri adulti delle loro famiglie, esclusi platform_admin, gestori, la
// coorte internal-preview e gli account esclusi nelle impostazioni.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REAL_DISCOVERY_LEADS } from "@/lib/discovery/real-dataset";
import { loadFamily } from "@/lib/data/family-reminders";
import { resolveThresholds, type ActionKind, type CockpitThresholds } from "@/lib/beta-cockpit/definitions";
import { addDays, romeDay, type ReportFrequency } from "@/lib/beta-cockpit/dates";
import {
  firstUnorganizedClosure,
  type CockpitRaw,
  type OnboardingState,
  type RawAction,
  type RawFamily,
  type RawMember,
  type RawOpenDay,
} from "@/lib/beta-cockpit/model";
import type { DemandSignal } from "@/lib/beta-cockpit/demand";
import { isCockpitFeedbackStatus, parseTags, type CockpitFeedbackRow } from "@/lib/beta-cockpit/feedback";
import { resolveSurveyConfig, type SurveyConfig } from "@/lib/beta-cockpit/survey";
import { isBetaFeedbackCategory, isMissingColumnError } from "@/lib/nextgen/beta-feedback-shared";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;
type Session = Awaited<ReturnType<typeof createClient>>;

export const BETA_COHORT_KEY = "trama-one-controlled-beta";
export const INTERNAL_COHORT_KEY = "internal-preview";
export const ONBOARDING_TUTORIAL_KEYS = ["family_onboarding_v2", "family_first_onboarding"];

// ── Impostazioni ──────────────────────────────────────────────────────────

export interface CockpitSettings {
  frequency: ReportFrequency;
  weekday: number;
  time: string;
  betaStart: string;
  thresholds: CockpitThresholds;
  excludedUserIds: string[];
  surveyConfig: SurveyConfig;
  /** false = migration 46 non applicata: valori di default, non salvabili. */
  tableReady: boolean;
}

export const DEFAULT_SETTINGS: CockpitSettings = {
  frequency: "weekly",
  weekday: 5,
  time: "09:00",
  betaStart: "2026-11-18",
  thresholds: resolveThresholds(null),
  excludedUserIds: [],
  surveyConfig: resolveSurveyConfig(null),
  tableReady: false,
};

export async function loadCockpitSettings(service: Service): Promise<CockpitSettings> {
  const { data, error } = await service
    .from("beta_cockpit_settings")
    .select("report_frequency, report_weekday, report_time, beta_start_date, thresholds, excluded_user_ids, survey_config")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  const freq = data.report_frequency as string;
  return {
    frequency: freq === "manual" || freq === "daily" ? freq : "weekly",
    weekday: Number(data.report_weekday) || 5,
    time: String(data.report_time ?? "09:00").slice(0, 5),
    betaStart: String(data.beta_start_date ?? DEFAULT_SETTINGS.betaStart),
    thresholds: resolveThresholds(data.thresholds),
    excludedUserIds: ((data.excluded_user_ids as string[] | null) ?? []).filter(Boolean),
    surveyConfig: resolveSurveyConfig(data.survey_config),
    tableReady: true,
  };
}

// ── Controllo admin ───────────────────────────────────────────────────────

/** Sessione dell'utente se è davvero platform_admin, altrimenti null. Nessuna query sui dati prima di questo. */
export async function requirePlatformAdmin(): Promise<{ supabase: Session; userId: string } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_admin") return null;
  return { supabase, userId: user.id };
}

// ── Dati del cockpit ──────────────────────────────────────────────────────

export interface CockpitMemberRef {
  userId: string;
  familyKey: string;
  /** Iniziali, mai il nome completo. */
  label: string;
  registeredAt: string;
  excluded: boolean;
}

export interface CockpitData {
  raw: CockpitRaw;
  feedback: CockpitFeedbackRow[];
  /** Risposte alle survey (per famiglia), già validate al salvataggio. */
  surveyResponses: { surveyId: string; familyKey: string | null; familyLabel: string | null; at: string; answers: Record<string, string> }[];
  demandSignals: DemandSignal[];
  zonesByFamily: Map<string, string[]>;
  settings: CockpitSettings;
  capabilities: { openDays: boolean; extendedFeedback: boolean; decisions: boolean };
  /** Adulti della beta e account esclusi (per la gestione delle esclusioni). */
  members: CockpitMemberRef[];
  familyLabels: Record<string, string>;
  todayIso: string;
  generatedAt: string;
}

function initials(fullName: string | null | undefined, fallback: string): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase() + ".")
    .join(" ");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "invitata";
  return `${local.slice(0, 2)}•••@${domain}`;
}

function rows<T>(res: { data: unknown; error: unknown }): T[] {
  return res.error || !Array.isArray(res.data) ? [] : (res.data as T[]);
}

/**
 * Carica e normalizza tutto. `session` serve solo per "app aperta"
 * (admin_beta_open_days); senza (es. dal cron) quei giorni mancano.
 */
export async function loadCockpitData(service: Service, session: Session | null, now: Date): Promise<CockpitData> {
  const todayIso = romeDay(now);
  const settings = await loadCockpitSettings(service);
  const excluded = new Set(settings.excludedUserIds);

  // 1. Popolazione
  const [cohortRes, internalRes, waitlistRes] = await Promise.all([
    service.from("beta_cohort_memberships").select("user_id").eq("cohort_key", BETA_COHORT_KEY).eq("active", true),
    service.from("beta_cohort_memberships").select("user_id").eq("cohort_key", INTERNAL_COHORT_KEY),
    service.from("beta_waitlist").select("id, email, note, source, invited_at, created_at").eq("status", "invitato"),
  ]);
  const internal = new Set(rows<{ user_id: string }>(internalRes).map((r) => r.user_id));
  const cohortIds = Array.from(new Set(rows<{ user_id: string }>(cohortRes).map((r) => r.user_id)));
  const waitlist = rows<{ id: string; email: string; note: string | null; source: string | null; invited_at: string | null; created_at: string }>(waitlistRes);

  // Famiglie dei membri della coorte, e tutti gli adulti di quelle famiglie
  const memberRes = cohortIds.length
    ? await service.from("family_members").select("family_id, parent_id, role, joined_at").in("parent_id", cohortIds)
    : { data: [], error: null };
  const familyIds = Array.from(new Set(rows<{ family_id: string }>(memberRes).map((r) => r.family_id)));
  const allMembersRes = familyIds.length
    ? await service.from("family_members").select("family_id, parent_id, role, joined_at").in("family_id", familyIds)
    : { data: [], error: null };
  const familyMembers = rows<{ family_id: string; parent_id: string; role: string; joined_at: string | null }>(allMembersRes);

  const candidateIds = Array.from(new Set([...cohortIds, ...familyMembers.map((m) => m.parent_id)]));
  const waitEmails = waitlist.map((w) => w.email.toLowerCase());
  const [profilesRes, waitProfilesRes, familiesRes] = await Promise.all([
    candidateIds.length
      ? service.from("profiles").select("id, full_name, email, role, created_at").in("id", candidateIds)
      : Promise.resolve({ data: [], error: null }),
    waitEmails.length
      ? service.from("profiles").select("id, email").in("email", waitEmails)
      : Promise.resolve({ data: [], error: null }),
    familyIds.length ? service.from("families").select("id, name").in("id", familyIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const profiles = rows<{ id: string; full_name: string | null; email: string | null; role: string; created_at: string }>(profilesRes);
  const isParent = (p: { role: string }) => p.role === "parent";
  const allAdults = profiles.filter(isParent).filter((p) => !internal.has(p.id));
  const people = allAdults.filter((p) => !excluded.has(p.id));
  const userIds = people.map((p) => p.id);
  const userSet = new Set(userIds);
  const familyNameById = new Map(rows<{ id: string; name: string | null }>(familiesRes).map((f) => [f.id, f.name]));

  const familyOfUser = new Map<string, string>();
  for (const m of familyMembers) if (userSet.has(m.parent_id)) familyOfUser.set(m.parent_id, m.family_id);
  const keyOf = (userId: string) => familyOfUser.get(userId) ?? `u:${userId}`;

  // Inviti dalla lista d'attesa: collegati per email alla famiglia registrata
  const emailToUser = new Map<string, string>();
  for (const p of rows<{ id: string; email: string | null }>(waitProfilesRes)) if (p.email) emailToUser.set(p.email.toLowerCase(), p.id);
  for (const p of profiles) if (p.email) emailToUser.set(p.email.toLowerCase(), p.id);
  const inviteByFamily = new Map<string, { at: string; label: string | null }>();
  const unregisteredInvites: typeof waitlist = [];
  for (const w of waitlist) {
    const uid = emailToUser.get(w.email.toLowerCase());
    const invitedAt = w.invited_at ?? w.created_at;
    const label = w.note?.trim() ? w.note.trim().slice(0, 60) : null;
    if (uid && userSet.has(uid)) {
      const k = keyOf(uid);
      const prev = inviteByFamily.get(k);
      if (!prev || invitedAt < prev.at) inviteByFamily.set(k, { at: invitedAt, label: label ?? prev?.label ?? null });
    } else if (!uid) {
      unregisteredInvites.push(w);
    }
  }

  // 2. Dati per utente (solo colonne necessarie)
  const by = <T,>(table: string, cols: string, col = "parent_id") =>
    userIds.length ? service.from(table).select(cols).in(col, userIds) : Promise.resolve({ data: [] as T[], error: null });

  const [
    tutorialRes,
    pushRes,
    kidsRes,
    schoolRes,
    itemsRes,
    respRes,
    familyInvitesRes,
    peopleRes,
    favRes,
    curFavRes,
    sharesRes,
    bookingsRes,
    inquiriesRes,
    leadsRes,
    radarRes,
    groupsRes,
    groupMembersRes,
    groupInvitesRes,
    carpoolOffersRes,
    carpoolReqRes,
    communityMembersRes,
    proposalsRes,
    interestRes,
    errorsRes,
  ] = await Promise.all([
    userIds.length
      ? service.from("tutorial_progress").select("user_id, tutorial_key, status, completed_at, updated_at").in("user_id", userIds).in("tutorial_key", ONBOARDING_TUTORIAL_KEYS)
      : Promise.resolve({ data: [], error: null }),
    by("push_subscriptions", "user_id", "user_id"),
    by("kids", "id, parent_id, created_at"),
    by("kid_school_profiles", "parent_id, kid_id, comune, created_at, updated_at"),
    by("external_planner_items", "id, parent_id, source_type, source_ref, title, location, organizer_snapshot, created_at, updated_at, deleted_at"),
    by("week_responsibilities", "parent_id, updated_at"),
    familyIds.length ? service.from("family_invites").select("family_id, invited_by, status, created_at").in("family_id", familyIds) : Promise.resolve({ data: [], error: null }),
    by("family_people", "parent_id, created_at"),
    by("favorites", "parent_id, activity_id, created_at"),
    by("curated_favorites", "parent_id, curated_lead_id, created_at"),
    by("plan_shares", "parent_id, created_at"),
    by("bookings", "parent_id, activity_id, status, partner_decision, responded_at, created_at"),
    by("activity_inquiries", "parent_id, activity_id, status, replied_at, created_at"),
    by("center_leads", "suggested_by, suggested_name, suggested_locality, lead_type, created_at", "suggested_by"),
    by("discovery_submissions", "submitted_by, community_discovery_id, created_at", "submitted_by"),
    by("groups", "created_by, created_at", "created_by"),
    by("group_members", "parent_id, joined_at"),
    by("group_invites", "invited_by, created_at", "invited_by"),
    by("carpool_offers", "parent_id, created_at"),
    by("carpool_requests", "parent_id, created_at"),
    by("community_members", "parent_id, joined_at"),
    by("community_activity_proposals", "proposed_by, created_at", "proposed_by"),
    by("community_activity_interest", "parent_id, created_at"),
    service
      .from("product_events")
      .select("created_at")
      .eq("event_name", "planner_subview_error")
      .gte("created_at", addDays(todayIso, -90) + "T00:00:00Z"),
  ]);

  // Feedback (con i tag se la migration 46 è applicata)
  const fbCols = "id, parent_id, area, page_path, message, status, admin_note, created_at, category, client_context, app_source";
  let fbRes: { data: unknown; error: { code?: string; message?: string } | null } = userIds.length
    ? await service.from("beta_feedback").select(`${fbCols}, admin_tags`).in("parent_id", userIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  let extendedFeedback = !fbRes.error;
  if (fbRes.error && isMissingColumnError(fbRes.error)) {
    fbRes = await service.from("beta_feedback").select(fbCols).in("parent_id", userIds).order("created_at", { ascending: false });
    extendedFeedback = false;
  }

  // Centri e attività citati (per la densità)
  const activityIds = Array.from(
    new Set([
      ...rows<{ activity_id: string }>(favRes).map((r) => r.activity_id),
      ...rows<{ activity_id: string }>(bookingsRes).map((r) => r.activity_id),
      ...rows<{ activity_id: string }>(inquiriesRes).map((r) => r.activity_id),
    ])
  ).filter(Boolean);
  const actsRes = activityIds.length
    ? await service.from("activities").select("id, name, city, center_id").in("id", activityIds)
    : { data: [], error: null };
  const acts = rows<{ id: string; name: string | null; city: string | null; center_id: string | null }>(actsRes);
  const centerIds = Array.from(new Set(acts.map((a) => a.center_id).filter((x): x is string => Boolean(x))));
  const communityIds = Array.from(
    new Set([
      ...rows<{ community_discovery_id: string | null }>(radarRes).map((r) => r.community_discovery_id),
      ...rows<{ source_type: string; source_ref: string | null }>(itemsRes)
        .filter((i) => i.source_type === "community_discovery")
        .map((i) => i.source_ref),
    ].filter((x): x is string => Boolean(x)))
  );
  const [centersRes, communityRes] = await Promise.all([
    centerIds.length ? service.from("centers").select("id, name, city").in("id", centerIds) : Promise.resolve({ data: [], error: null }),
    communityIds.length
      ? service.from("community_discoveries").select("id, title, organizer_name, comune").in("id", communityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const centerById = new Map(rows<{ id: string; name: string | null; city: string | null }>(centersRes).map((c) => [c.id, c]));
  const actById = new Map(acts.map((a) => [a.id, a]));
  const communityById = new Map(
    rows<{ id: string; title: string | null; organizer_name: string | null; comune: string | null }>(communityRes).map((c) => [c.id, c])
  );
  const leadById = new Map(REAL_DISCOVERY_LEADS.map((l) => [l.id, l]));

  // 3. Azioni significative
  const actions: RawAction[] = [];
  const push = (userId: string | null | undefined, at: string | null | undefined, kind: ActionKind, active?: boolean) => {
    if (!userId || !at || !userSet.has(userId)) return;
    actions.push({ familyKey: keyOf(userId), userId, at, kind, ...(active === false ? { active: false } : {}) });
  };
  type Item = { id: string; parent_id: string; source_type: string; source_ref: string | null; title: string | null; location: string | null; organizer_snapshot: string | null; created_at: string; updated_at: string | null; deleted_at: string | null };
  const items = rows<Item>(itemsRes);
  for (const k of rows<{ parent_id: string; created_at: string }>(kidsRes)) push(k.parent_id, k.created_at, "kid_added");
  for (const s of rows<{ parent_id: string; created_at: string; updated_at: string | null }>(schoolRes)) {
    push(s.parent_id, s.created_at, "school_set");
  }
  for (const i of items) {
    const active = !i.deleted_at;
    push(i.parent_id, i.created_at, i.source_type === "manual" ? "commitment_created" : "discovery_to_planner", active);
    if (i.updated_at && Date.parse(i.updated_at) - Date.parse(i.created_at) > 60_000 && !i.deleted_at) push(i.parent_id, i.updated_at, "commitment_updated");
  }
  for (const r of rows<{ parent_id: string; updated_at: string }>(respRes)) push(r.parent_id, r.updated_at, "coordination_set");
  for (const fi of rows<{ invited_by: string | null; created_at: string }>(familyInvitesRes)) push(fi.invited_by, fi.created_at, "partner_invited");
  for (const m of familyMembers) if (m.role !== "creatore") push(m.parent_id, m.joined_at, "partner_joined");
  for (const p of rows<{ parent_id: string; created_at: string }>(peopleRes)) push(p.parent_id, p.created_at, "helper_added");
  for (const f of rows<{ parent_id: string; created_at: string }>(favRes)) push(f.parent_id, f.created_at, "saved");
  for (const f of rows<{ parent_id: string; created_at: string }>(curFavRes)) push(f.parent_id, f.created_at, "saved");
  for (const s of rows<{ parent_id: string; created_at: string }>(sharesRes)) push(s.parent_id, s.created_at, "plan_shared");
  for (const b of rows<{ parent_id: string; status: string; created_at: string }>(bookingsRes)) push(b.parent_id, b.created_at, "booking_requested", b.status !== "cancelled");
  for (const q of rows<{ parent_id: string; created_at: string }>(inquiriesRes)) push(q.parent_id, q.created_at, "inquiry_sent");
  for (const l of rows<{ suggested_by: string | null; lead_type: string; created_at: string }>(leadsRes)) if (l.lead_type === "parent_referral") push(l.suggested_by, l.created_at, "center_suggested");
  for (const r of rows<{ submitted_by: string; created_at: string }>(radarRes)) push(r.submitted_by, r.created_at, "radar_submitted");
  for (const g of rows<{ created_by: string; created_at: string }>(groupsRes)) push(g.created_by, g.created_at, "group_created");
  for (const g of rows<{ parent_id: string; joined_at: string | null }>(groupMembersRes)) push(g.parent_id, g.joined_at, "group_joined");
  for (const g of rows<{ invited_by: string | null; created_at: string }>(groupInvitesRes)) push(g.invited_by, g.created_at, "group_invite_sent");
  for (const c of [...rows<{ parent_id: string; created_at: string }>(carpoolOffersRes), ...rows<{ parent_id: string; created_at: string }>(carpoolReqRes)]) push(c.parent_id, c.created_at, "carpool");
  for (const c of rows<{ parent_id: string; joined_at: string | null }>(communityMembersRes)) push(c.parent_id, c.joined_at, "class_joined");
  for (const c of rows<{ proposed_by: string; created_at: string }>(proposalsRes)) push(c.proposed_by, c.created_at, "class_proposal");
  for (const c of rows<{ parent_id: string; created_at: string }>(interestRes)) push(c.parent_id, c.created_at, "class_proposal");

  type Fb = { id: string; parent_id: string; area: string; page_path: string; message: string; status: string; admin_note: string | null; created_at: string; category: string | null; client_context: Record<string, unknown> | null; app_source: string; admin_tags?: string[] | null };
  const fbRows = rows<Fb>(fbRes);
  for (const f of fbRows) push(f.parent_id, f.created_at, f.area?.startsWith("survey_") ? "survey_answered" : "feedback_sent");

  // 4. Famiglie
  const tutorials = rows<{ user_id: string; tutorial_key: string; status: string; completed_at: string | null; updated_at: string | null }>(tutorialRes);
  const onboardingOf = (uid: string): { state: OnboardingState; at: string | null } => {
    const list = tutorials.filter((t) => t.user_id === uid);
    const done = list.find((t) => t.status === "completed" || t.status === "skipped");
    if (done) return { state: done.status as OnboardingState, at: done.completed_at ?? done.updated_at };
    if (list.some((t) => t.status === "in_progress")) return { state: "in_progress", at: null };
    return { state: "not_started", at: null };
  };
  const pushCount = new Map<string, number>();
  for (const p of rows<{ user_id: string }>(pushRes)) pushCount.set(p.user_id, (pushCount.get(p.user_id) ?? 0) + 1);

  const kidsByFamily = new Map<string, number>();
  for (const k of rows<{ parent_id: string }>(kidsRes)) kidsByFamily.set(keyOf(k.parent_id), (kidsByFamily.get(keyOf(k.parent_id)) ?? 0) + 1);
  const schoolKidsByFamily = new Map<string, Set<string>>();
  const zonesByFamily = new Map<string, string[]>();
  const schoolParentByFamily = new Map<string, string>();
  for (const s of rows<{ parent_id: string; kid_id: string; comune: string | null }>(schoolRes)) {
    const k = keyOf(s.parent_id);
    (schoolKidsByFamily.get(k) ?? schoolKidsByFamily.set(k, new Set()).get(k)!).add(s.kid_id);
    if (s.comune) zonesByFamily.set(k, Array.from(new Set([...(zonesByFamily.get(k) ?? []), s.comune])));
    schoolParentByFamily.set(k, s.parent_id);
  }

  const pendingInvitesByFamily = new Map<string, string[]>();
  for (const fi of rows<{ family_id: string; status: string; created_at: string }>(familyInvitesRes)) {
    if (fi.status !== "pending" && fi.status !== "sent") continue;
    pendingInvitesByFamily.set(fi.family_id, [...(pendingInvitesByFamily.get(fi.family_id) ?? []), fi.created_at]);
  }
  const openRequestsByFamily = new Map<string, string[]>();
  const addOpen = (uid: string, at: string) => {
    if (!userSet.has(uid)) return;
    const k = keyOf(uid);
    openRequestsByFamily.set(k, [...(openRequestsByFamily.get(k) ?? []), at]);
  };
  for (const b of rows<{ parent_id: string; status: string; partner_decision: string | null; responded_at: string | null; created_at: string }>(bookingsRes)) {
    if (b.status === "pending" && !b.responded_at && (!b.partner_decision || b.partner_decision === "pending")) addOpen(b.parent_id, b.created_at);
  }
  for (const q of rows<{ parent_id: string; status: string; replied_at: string | null; created_at: string }>(inquiriesRes)) {
    if (q.status === "aperta" && !q.replied_at) addOpen(q.parent_id, q.created_at);
  }

  // Salvati mai collocati: centro salvato senza richiesta/prenotazione; scoperta salvata mai nel Planner
  const placedActivities = new Map<string, Set<string>>();
  for (const b of [...rows<{ parent_id: string; activity_id: string }>(bookingsRes), ...rows<{ parent_id: string; activity_id: string }>(inquiriesRes)]) {
    if (!userSet.has(b.parent_id)) continue;
    const k = keyOf(b.parent_id);
    (placedActivities.get(k) ?? placedActivities.set(k, new Set()).get(k)!).add(b.activity_id);
  }
  const placedLeads = new Map<string, Set<string>>();
  for (const i of items) {
    if (i.source_type === "manual" || !i.source_ref || !userSet.has(i.parent_id)) continue;
    const k = keyOf(i.parent_id);
    (placedLeads.get(k) ?? placedLeads.set(k, new Set()).get(k)!).add(i.source_ref);
  }
  const savedNotPlaced = new Map<string, number>();
  for (const f of rows<{ parent_id: string; activity_id: string }>(favRes)) {
    if (!userSet.has(f.parent_id)) continue;
    const k = keyOf(f.parent_id);
    if (!placedActivities.get(k)?.has(f.activity_id)) savedNotPlaced.set(k, (savedNotPlaced.get(k) ?? 0) + 1);
  }
  for (const f of rows<{ parent_id: string; curated_lead_id: string }>(curFavRes)) {
    if (!userSet.has(f.parent_id)) continue;
    const k = keyOf(f.parent_id);
    if (!placedLeads.get(k)?.has(f.curated_lead_id)) savedNotPlaced.set(k, (savedNotPlaced.get(k) ?? 0) + 1);
  }

  // Chiusure della scuola entro 14 giorni non organizzate (stesso caricamento dei promemoria serali)
  const closureByFamily = new Map<string, { from: string; to: string } | null>();
  await Promise.all(
    Array.from(schoolParentByFamily.entries()).map(async ([k, parentId]) => {
      try {
        const fam = await loadFamily(service, parentId, todayIso);
        closureByFamily.set(k, firstUnorganizedClosure(fam.closurePeriods, fam.coverage, todayIso, 14));
      } catch {
        closureByFamily.set(k, null);
      }
    })
  );

  const familyKeys = new Map<string, RawMember[]>();
  for (const p of people) {
    const k = keyOf(p.id);
    const ob = onboardingOf(p.id);
    const list = familyKeys.get(k) ?? [];
    list.push({ userId: p.id, registeredAt: p.created_at, onboarding: ob.state, onboardingAt: ob.at, pushDevices: pushCount.get(p.id) ?? 0 });
    familyKeys.set(k, list);
  }
  // Una famiglia entra nel cockpit se almeno un suo adulto è nella coorte
  const cohortSet = new Set(cohortIds);
  const families: RawFamily[] = [];
  const familyLabels: Record<string, string> = {};
  for (const [k, members] of familyKeys) {
    if (!members.some((m) => cohortSet.has(m.userId))) continue;
    const invite = inviteByFamily.get(k);
    const familyName = k.startsWith("u:") ? null : (familyNameById.get(k) ?? null);
    const firstProfile = profiles.find((p) => p.id === members[0].userId);
    const label = invite?.label ?? familyName ?? initials(firstProfile?.full_name, "Famiglia");
    familyLabels[k] = label;
    families.push({
      key: k,
      label,
      invitedAt: invite?.at ?? null,
      members,
      kids: kidsByFamily.get(k) ?? 0,
      kidsWithSchool: schoolKidsByFamily.get(k)?.size ?? 0,
      zones: zonesByFamily.get(k) ?? [],
      pendingPartnerInvites: k.startsWith("u:") ? [] : (pendingInvitesByFamily.get(k) ?? []),
      openCenterRequests: openRequestsByFamily.get(k) ?? [],
      savedNotPlaced: savedNotPlaced.get(k) ?? 0,
      unorganizedClosure: closureByFamily.get(k) ?? null,
    });
  }
  for (const w of unregisteredInvites) {
    const k = `w:${w.id}`;
    const label = w.note?.trim() ? w.note.trim().slice(0, 60) : maskEmail(w.email);
    familyLabels[k] = label;
    families.push({
      key: k,
      label,
      invitedAt: w.invited_at ?? w.created_at,
      members: [],
      kids: 0,
      kidsWithSchool: 0,
      zones: [],
      pendingPartnerInvites: [],
      openCenterRequests: [],
      savedNotPlaced: 0,
      unorganizedClosure: null,
    });
  }
  const inFamilies = new Set(families.map((f) => f.key));
  const keptActions = actions.filter((a) => inFamilies.has(a.familyKey));

  // 5. Giorni con app aperta (migration 46, client di sessione)
  let openDays: RawOpenDay[] | null = null;
  if (session && userIds.length) {
    const since = addDays(settings.betaStart < todayIso ? settings.betaStart : todayIso, -45) + "T00:00:00Z";
    const { data, error } = await session.rpc("admin_beta_open_days", { p_user_ids: userIds, p_since: since });
    if (!error && Array.isArray(data)) {
      const seen = new Set<string>();
      openDays = [];
      for (const r of data as { user_id: string; day: string }[]) {
        const k = keyOf(r.user_id);
        if (!inFamilies.has(k) || seen.has(`${k}|${r.day}`)) continue;
        seen.add(`${k}|${r.day}`);
        openDays.push({ familyKey: k, day: r.day });
      }
    }
  }

  // 6. Feedback e survey
  const feedback: CockpitFeedbackRow[] = [];
  const surveyResponses: CockpitData["surveyResponses"] = [];
  for (const f of fbRows) {
    if (!userSet.has(f.parent_id)) continue;
    const familyKey = keyOf(f.parent_id);
    const surveyId = f.area?.startsWith("survey_") ? f.area : null;
    feedback.push({
      id: f.id,
      familyKey: inFamilies.has(familyKey) ? familyKey : null,
      familyLabel: familyLabels[familyKey] ?? null,
      at: f.created_at,
      category: isBetaFeedbackCategory(f.category) ? f.category : null,
      area: f.area,
      pagePath: f.page_path,
      message: f.message,
      status: isCockpitFeedbackStatus(f.status) ? f.status : "nuovo",
      tags: parseTags(f.admin_tags ?? []),
      adminNote: f.admin_note,
      source: f.app_source === "gestore" ? "gestore" : "genitori",
      surveyId,
    });
    const answers = (f.client_context as { survey?: { answers?: Record<string, string> } } | null)?.survey?.answers;
    if (surveyId && answers && typeof answers === "object") {
      surveyResponses.push({ surveyId, familyKey, familyLabel: familyLabels[familyKey] ?? null, at: f.created_at, answers });
    }
  }

  // 7. Segnali di domanda verso i centri
  const demandSignals: DemandSignal[] = [];
  const sig = (uid: string | null | undefined, name: string | null | undefined, locality: string | null | undefined, type: DemandSignal["type"], at: string) => {
    if (!uid || !name?.trim() || !userSet.has(uid)) return;
    const k = keyOf(uid);
    if (!inFamilies.has(k)) return;
    demandSignals.push({ familyKey: k, name: name.trim(), locality: locality?.trim() || null, type, at });
  };
  const centerOfActivity = (activityId: string) => {
    const a = actById.get(activityId);
    const c = a?.center_id ? centerById.get(a.center_id) : null;
    return { name: c?.name ?? a?.name ?? null, locality: c?.city ?? a?.city ?? null };
  };
  for (const f of rows<{ parent_id: string; activity_id: string; created_at: string }>(favRes)) {
    const c = centerOfActivity(f.activity_id);
    sig(f.parent_id, c.name, c.locality, "partner_salvato", f.created_at);
  }
  for (const b of [...rows<{ parent_id: string; activity_id: string; created_at: string }>(bookingsRes), ...rows<{ parent_id: string; activity_id: string; created_at: string }>(inquiriesRes)]) {
    const c = centerOfActivity(b.activity_id);
    sig(b.parent_id, c.name, c.locality, "partner_richiesta", b.created_at);
  }
  for (const f of rows<{ parent_id: string; curated_lead_id: string; created_at: string }>(curFavRes)) {
    const l = leadById.get(f.curated_lead_id);
    sig(f.parent_id, l?.organizerName, l?.comune, "scoperta_salvata", f.created_at);
  }
  for (const i of items) {
    if (i.deleted_at) continue;
    if (i.source_type === "curated_discovery") {
      const l = i.source_ref ? leadById.get(i.source_ref) : undefined;
      sig(i.parent_id, l?.organizerName ?? i.organizer_snapshot, l?.comune, "scoperta_nel_planner", i.created_at);
    } else if (i.source_type === "community_discovery") {
      const c = i.source_ref ? communityById.get(i.source_ref) : undefined;
      sig(i.parent_id, c?.organizer_name ?? c?.title ?? i.organizer_snapshot, c?.comune, "community_nel_planner", i.created_at);
    } else {
      sig(i.parent_id, i.location?.trim() || i.title, null, "impegno_manuale", i.created_at);
    }
  }
  for (const l of rows<{ suggested_by: string | null; suggested_name: string; suggested_locality: string | null; lead_type: string; created_at: string }>(leadsRes)) {
    if (l.lead_type === "parent_referral") sig(l.suggested_by, l.suggested_name, l.suggested_locality, "centro_suggerito", l.created_at);
  }
  for (const r of rows<{ submitted_by: string; community_discovery_id: string | null; created_at: string }>(radarRes)) {
    const c = r.community_discovery_id ? communityById.get(r.community_discovery_id) : undefined;
    if (c) sig(r.submitted_by, c.organizer_name ?? c.title, c.comune, "radar", r.created_at);
  }

  // Decision log disponibile?
  const decisionsProbe = await service.from("beta_decisions").select("id", { head: true, count: "exact" });

  const members: CockpitMemberRef[] = allAdults
    .filter((p) => cohortSet.has(p.id) || familyMembers.some((m) => m.parent_id === p.id))
    .map((p) => ({
      userId: p.id,
      familyKey: excluded.has(p.id) ? `u:${p.id}` : keyOf(p.id),
      label: initials(p.full_name, "Account"),
      registeredAt: p.created_at,
      excluded: excluded.has(p.id),
    }));

  return {
    raw: {
      families,
      actions: keptActions,
      openDays,
      technicalErrors: rows<{ created_at: string }>(errorsRes).map((e) => e.created_at),
    },
    feedback,
    surveyResponses,
    demandSignals,
    zonesByFamily,
    settings,
    capabilities: { openDays: openDays !== null, extendedFeedback, decisions: !decisionsProbe.error },
    members,
    familyLabels,
    todayIso,
    generatedAt: now.toISOString(),
  };
}

/** Punto d'ingresso delle pagine Admin: null se non admin o Supabase non configurato. */
export async function getBetaCockpitData(): Promise<CockpitData | null> {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const service = createServiceClient();
  if (!service) return null;
  return loadCockpitData(service, admin.supabase, new Date());
}

// ── Decision log ──────────────────────────────────────────────────────────

export interface BetaDecision {
  id: string;
  periodStart: string;
  periodEnd: string;
  observation: string;
  hypothesis: string | null;
  decision: string | null;
  action: string | null;
  owner: string | null;
  dueDate: string | null;
  status: "aperta" | "fatta" | "annullata";
  createdAt: string;
}

/** Decisioni (tutte, la più recente prima). null = migration 46 non applicata. */
export async function getBetaDecisions(): Promise<BetaDecision[] | null> {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const { data, error } = await admin.supabase
    .from("beta_decisions")
    .select("id, period_start, period_end, observation, hypothesis, decision, action, owner, due_date, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return null;
  return (data ?? []).map((d) => ({
    id: d.id as string,
    periodStart: d.period_start as string,
    periodEnd: d.period_end as string,
    observation: d.observation as string,
    hypothesis: (d.hypothesis as string | null) ?? null,
    decision: (d.decision as string | null) ?? null,
    action: (d.action as string | null) ?? null,
    owner: (d.owner as string | null) ?? null,
    dueDate: (d.due_date as string | null) ?? null,
    status: (d.status as BetaDecision["status"]) ?? "aperta",
    createdAt: d.created_at as string,
  }));
}
