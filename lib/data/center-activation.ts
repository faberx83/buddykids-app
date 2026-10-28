// TRAMA — PORTALE CENTRI V2, FASE 1: lettura dei fatti di attivazione
// (27/10/2026). La logica sta in lib/centers/activation.ts (pura); qui solo
// le letture, tutte in poche query a lotti:
// - lato centro: il proprio centro, con il client di sessione (RLS: il
//   gestore vede stato, storico e checklist del proprio centro);
// - lato Admin: tutti i centri in attivazione, solo dopo aver verificato
//   server-side che chi chiede sia platform_admin (stesso principio di
//   lib/data/pilot-users.ts: niente dati nel payload a chi non è Admin);
// - per il catalogo delle famiglie: gli id dei centri non ancora attivi, col
//   client di servizio (una famiglia non può leggere center_onboarding_state).
// Ogni errore → valori prudenti, mai una pagina rotta.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import type { CenterOnboardingStatus } from "@/lib/onboarding/types";
import { PARTNER_V2_FLAG, type ActivationFacts } from "@/lib/centers/activation";

type Client = NonNullable<ReturnType<typeof createServiceClient>> | Awaited<ReturnType<typeof createClient>>;

function todayRomeIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

interface CenterRow {
  id: string;
  name: string | null;
  city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  address: string | null;
  cancellation_window_days: number | null;
  created_at: string | null;
}

interface StateRow {
  center_id: string;
  status: CenterOnboardingStatus;
  updated_at: string | null;
  referent_confirmed_at?: string | null;
  activities_checked_at?: string | null;
}

export interface ActivationHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface CenterActivation {
  centerId: string;
  name: string;
  city: string | null;
  createdAt: string | null;
  facts: ActivationFacts;
  history: ActivationHistoryEntry[];
}

/** I fatti di attivazione per uno o più centri, in query a lotti. */
async function readActivations(supabase: Client, centerIds: string[] | null): Promise<CenterActivation[]> {
  const today = todayRomeIso();
  let centersQuery = supabase
    .from("centers")
    .select("id, name, city, contact_email, contact_phone, description, address, cancellation_window_days, created_at");
  if (centerIds) centersQuery = centersQuery.in("id", centerIds);
  const { data: centers } = await centersQuery;
  const list = (centers ?? []) as CenterRow[];
  if (list.length === 0) return [];
  const ids = list.map((c) => c.id);

  const [stateRes, checklistRes, actsRes, auditRes] = await Promise.all([
    // "*" e non un elenco: senza migration_55 le colonne delle verifiche non
    // ci sono ancora e un elenco esplicito farebbe fallire tutta la lettura.
    supabase.from("center_onboarding_state").select("*").in("center_id", ids),
    supabase
      .from("center_onboarding_checklist_completions")
      .select("center_id, item_key, completed")
      .in("center_id", ids)
      .eq("item_key", "cancellation_policy_set"),
    supabase.from("activities").select("id, center_id").in("center_id", ids),
    supabase
      .from("center_onboarding_audit_log")
      .select("center_id, from_status, to_status, note, created_at")
      .in("center_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const stateBy = new Map(((stateRes.data ?? []) as StateRow[]).map((s) => [s.center_id, s]));
  const cancelConfirmed = new Set(
    ((checklistRes.data ?? []) as { center_id: string; completed: boolean }[]).filter((r) => r.completed).map((r) => r.center_id)
  );
  const acts = (actsRes.data ?? []) as { id: string; center_id: string }[];
  const centerOfActivity = new Map(acts.map((a) => [a.id, a.center_id]));
  const actIds = acts.map((a) => a.id);

  const datedActivities = new Set<string>();
  if (actIds.length > 0) {
    const [daysRes, weeksRes] = await Promise.all([
      supabase.from("activity_days").select("activity_id").in("activity_id", actIds).eq("is_open", true).gte("date", today),
      supabase.from("activity_weeks").select("activity_id").in("activity_id", actIds).gte("end_date", today),
    ]);
    for (const r of (daysRes.data ?? []) as { activity_id: string }[]) datedActivities.add(r.activity_id);
    for (const r of (weeksRes.data ?? []) as { activity_id: string }[]) datedActivities.add(r.activity_id);
  }
  const datedByCenter = new Map<string, number>();
  for (const a of datedActivities) {
    const c = centerOfActivity.get(a);
    if (c) datedByCenter.set(c, (datedByCenter.get(c) ?? 0) + 1);
  }

  const historyBy = new Map<string, ActivationHistoryEntry[]>();
  for (const r of (auditRes.data ?? []) as { center_id: string; from_status: string | null; to_status: string; note: string | null; created_at: string }[]) {
    const h = historyBy.get(r.center_id) ?? [];
    h.push({ fromStatus: r.from_status, toStatus: r.to_status, note: r.note, createdAt: r.created_at });
    historyBy.set(r.center_id, h);
  }

  return list.map((c) => {
    const s = stateBy.get(c.id) ?? null;
    const history = historyBy.get(c.id) ?? [];
    const lastChanges = history.find((h) => h.toStatus === "CHANGES_REQUESTED" && h.fromStatus !== h.toStatus);
    const lastSubmit = history.find((h) => h.toStatus === "SUBMITTED" && h.fromStatus !== h.toStatus);
    return {
      centerId: c.id,
      name: c.name ?? "Centro",
      city: c.city,
      createdAt: c.created_at,
      history,
      facts: {
        status: s ? s.status : null,
        profile: {
          name: c.name,
          city: c.city,
          contactEmail: c.contact_email,
          contactPhone: c.contact_phone,
          description: c.description,
          address: c.address,
          cancellationWindowDays: c.cancellation_window_days,
          cancellationConfirmed: cancelConfirmed.has(c.id),
          activitiesWithFutureDates: datedByCenter.get(c.id) ?? 0,
        },
        referentConfirmed: Boolean(s?.referent_confirmed_at),
        activitiesChecked: Boolean(s?.activities_checked_at),
        changesNote: lastChanges?.note ?? null,
        submittedAt: lastSubmit?.createdAt ?? null,
      },
    };
  });
}

/** Il centro del gestore collegato (portale centri). */
export async function getMyCenterActivation(centerId: string | null): Promise<CenterActivation | null> {
  if (!isSupabaseConfigured || !centerId) return null;
  try {
    const supabase = await createClient();
    const [one] = await readActivations(supabase, [centerId]);
    return one ?? null;
  } catch {
    return null;
  }
}

async function isPlatformAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "platform_admin";
}

export interface AdminCenterActivation extends CenterActivation {
  source: string | null; // da dove è arrivata la candidatura
  adminEmails: string[];
}

/** Tutti i centri con uno stato di attivazione (Admin → Centri da attivare). */
export async function getCentersForActivation(): Promise<AdminCenterActivation[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    if (!(await isPlatformAdmin(supabase))) return [];
    const { data: states } = await supabase.from("center_onboarding_state").select("center_id");
    const ids = ((states ?? []) as { center_id: string }[]).map((s) => s.center_id);
    if (ids.length === 0) return [];
    const [rows, leadsRes, adminsRes] = await Promise.all([
      readActivations(supabase, ids),
      supabase.from("center_leads").select("claimed_center_id, demand_context").eq("lead_type", "self_candidacy").in("claimed_center_id", ids),
      supabase.from("profiles").select("center_id, email").eq("role", "center_admin").in("center_id", ids),
    ]);
    const sourceBy = new Map<string, string | null>();
    for (const l of (leadsRes.data ?? []) as { claimed_center_id: string; demand_context: { campaignSource?: string } | null }[]) {
      sourceBy.set(l.claimed_center_id, l.demand_context?.campaignSource ?? "candidatura");
    }
    const adminsBy = new Map<string, string[]>();
    for (const a of (adminsRes.data ?? []) as { center_id: string; email: string | null }[]) {
      if (!a.email) continue;
      adminsBy.set(a.center_id, [...(adminsBy.get(a.center_id) ?? []), a.email]);
    }
    return rows.map((r) => ({ ...r, source: sourceBy.get(r.centerId) ?? null, adminEmails: adminsBy.get(r.centerId) ?? [] }));
  } catch {
    return [];
  }
}

/**
 * Centri da tenere fuori dal catalogo delle famiglie perché non ancora
 * attivi: solo con PARTNER_V2_ENABLED acceso per chi guarda. I centri senza
 * stato (esistenti prima dell'attivazione) restano visibili. L'Admin vede tutto.
 */
export async function getInactiveCenterIdsForViewer(userId: string | null, role: string | null): Promise<Set<string>> {
  if (!isSupabaseConfigured || role === "platform_admin") return new Set();
  try {
    const on = await resolveFeatureFlag({ flagName: PARTNER_V2_FLAG, userId, role }).catch(() => false);
    if (!on) return new Set();
    const service = createServiceClient();
    if (!service) return new Set();
    const { data, error } = await service.from("center_onboarding_state").select("center_id").neq("status", "APPROVED");
    if (error || !data) return new Set();
    return new Set((data as { center_id: string }[]).map((r) => r.center_id));
  } catch {
    return new Set();
  }
}

/** Unione di due insiemi di centri da nascondere (prova + non attivi). */
export function unionCenterIds(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  return new Set([...a, ...b]);
}
