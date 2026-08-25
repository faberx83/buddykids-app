import "server-only";

// TRAMA ONE Build Sprint 1 — letture per l'onboarding Centro. Usa
// createClient() (sessione dell'utente, RLS applicata) — mai il client
// service-role: queste letture devono passare dalle policy definite in
// supabase/migration_09_center_onboarding.sql (proprietario o
// platform_admin), non bypassarle.
//
// Modalità demo (Supabase non configurato): ritorna sempre valori di
// fallback sicuri (stato APPROVED, checklist vuota) — stesso principio già
// applicato in lib/data/center-admin.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ONBOARDING_CHECKLIST_REGISTRY } from "./checklist-registry";
import type {
  CenterOnboardingState,
  CenterOnboardingStatus,
  ChecklistItemState,
  IdentityVerificationState,
  OnboardingAuditEntry,
  CenterForReview,
  CenterOperabilityRow,
} from "./types";

export async function getCenterOnboardingState(centerId: string | null): Promise<CenterOnboardingState> {
  if (!isSupabaseConfigured || !centerId) {
    return { centerId: centerId ?? "", status: "APPROVED", updatedAt: null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_onboarding_state")
    .select("status, updated_at")
    .eq("center_id", centerId)
    .maybeSingle();

  // Nessuna riga = centro creato prima di Sprint 1: trattato come APPROVED,
  // comportamento AS-IS preservato senza bisogno di backfill (vedi commento
  // in migration_09_center_onboarding.sql e
  // SPRINT_1_FEATURE_PRESERVATION_MATRIX.md).
  if (!data) {
    return { centerId, status: "APPROVED", updatedAt: null };
  }

  return { centerId, status: data.status as CenterOnboardingStatus, updatedAt: data.updated_at };
}

export async function getChecklistCompletions(centerId: string | null): Promise<ChecklistItemState[]> {
  const base: ChecklistItemState[] = ONBOARDING_CHECKLIST_REGISTRY.map((item) => ({
    itemKey: item.key,
    completed: false,
    completedAt: null,
  }));

  if (!isSupabaseConfigured || !centerId) return base;

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_onboarding_checklist_completions")
    .select("item_key, completed, completed_at")
    .eq("center_id", centerId);

  if (!data) return base;

  const byKey = new Map(data.map((row) => [row.item_key, row]));
  return base.map((item) => {
    const row = byKey.get(item.itemKey);
    return row ? { itemKey: item.itemKey, completed: Boolean(row.completed), completedAt: row.completed_at } : item;
  });
}

export async function getIdentityVerification(centerId: string | null): Promise<IdentityVerificationState> {
  const empty: IdentityVerificationState = { status: "not_started", note: null, documentUrl: null, reviewedAt: null };
  if (!isSupabaseConfigured || !centerId) return empty;

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_identity_verifications")
    .select("status, note, document_url, reviewed_at")
    .eq("center_id", centerId)
    .maybeSingle();

  if (!data) return empty;

  return {
    status: data.status as IdentityVerificationState["status"],
    note: data.note,
    documentUrl: data.document_url,
    reviewedAt: data.reviewed_at,
  };
}

export async function getOnboardingAuditLog(centerId: string | null): Promise<OnboardingAuditEntry[]> {
  if (!isSupabaseConfigured || !centerId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_onboarding_audit_log")
    .select("id, from_status, to_status, actor_id, note, created_at")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  }));
}

interface AdminReviewRow {
  center_id: string;
  status: CenterOnboardingStatus;
  updated_at: string | null;
  centers: { name: string } | { name: string }[] | null;
}

/** Solo per platform_admin (RLS lo impone comunque): centri con una riga in
 * center_onboarding_state, per la coda di revisione Admin. Un centro SENZA
 * riga (AS-IS, APPROVED implicito, mai reclamato per TRAMA ONE) non compare
 * qui — non richiede alcuna azione. Include anche APPROVED/SUSPENDED (non
 * solo gli stati "da revisionare"): il chiamante (AdminOnboardingReviewClient)
 * separa "In revisione" (SUBMITTED) da "Altri stati" (tutto il resto), ma la
 * query deve restituire tutti gli stati o un centro APPROVED sparirebbe
 * dalla UI subito dopo l'approvazione, impedendo di vederlo per sospenderlo. */
export async function listCentersForAdminReview(): Promise<CenterForReview[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_onboarding_state")
    .select("center_id, status, updated_at, centers ( name )")
    .in("status", ["LEAD", "CLAIMED", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "SUSPENDED"])
    .order("updated_at", { ascending: false });

  if (!data) return [];

  return (data as unknown as AdminReviewRow[]).map((row) => {
    const centerRel = Array.isArray(row.centers) ? row.centers[0] : row.centers;
    return {
      centerId: row.center_id,
      centerName: centerRel?.name ?? row.center_id,
      status: row.status,
      updatedAt: row.updated_at,
    };
  });
}

// PRE-MICRO-PILOT GATE (R-01, task #557, 25/08/2026) — segnalazione di
// Fabrizio: /admin/centers (unica superficie Admin pensata per "trovare un
// centro") è SEMPRE lib/mock-data.ts, anche dopo aver creato un centro reale
// — un Admin non ha modo di trovare un centro pilota reale senza query SQL
// dirette o conoscere l'ID. Obiettivo esplicito: NON costruire una nuova
// dashboard, rendere reale questa. A differenza di
// listCentersForAdminReview() sopra (pensata per la coda di revisione
// onboarding: un centro SENZA riga in center_onboarding_state non compare
// perché "non richiede alcuna azione"), questa funzione deve elencare
// LETTERALMENTE OGNI centro nella tabella centers — un Admin deve poter
// trovare qualunque centro, non solo quelli con un'azione pendente.
//
// Nessuna nuova RPC/aggregazione lato DB: 3 letture semplici via
// createClient() (RLS applicata, mai service-role) fuse in JS — a questa
// scala (decine di centri per un Micro Pilot, non migliaia) è la scelta più
// semplice e più facile da verificare a colpo d'occhio.
function isLikelyTestCenter(name: string, slug: string): boolean {
  const pattern = /\btest\b|^\[test\]|\bprova\b/i;
  return pattern.test(name) || pattern.test(slug);
}

export async function listAllCentersForAdmin(): Promise<CenterOperabilityRow[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();

  const [{ data: centers }, { data: onboardingRows }, { data: activityRows }] = await Promise.all([
    supabase.from("centers").select("id, slug, name, city, created_at").order("created_at", { ascending: false }),
    supabase.from("center_onboarding_state").select("center_id, status"),
    supabase.from("activities").select("center_id"),
  ]);

  if (!centers) return [];

  const statusByCenter = new Map((onboardingRows ?? []).map((r) => [r.center_id, r.status as CenterOnboardingStatus]));
  const activityCountByCenter = new Map<string, number>();
  for (const row of activityRows ?? []) {
    activityCountByCenter.set(row.center_id, (activityCountByCenter.get(row.center_id) ?? 0) + 1);
  }

  return centers.map((c) => ({
    centerId: c.id,
    slug: c.slug,
    name: c.name,
    city: c.city,
    createdAt: c.created_at,
    activityCount: activityCountByCenter.get(c.id) ?? 0,
    // Nessuna riga in center_onboarding_state = centro creato prima di
    // Sprint 1 (o mai reclamato per TRAMA ONE) — stesso fallback APPROVED di
    // getCenterOnboardingState() sopra, per coerenza in tutta l'app.
    onboardingStatus: statusByCenter.get(c.id) ?? "APPROVED",
    looksLikeTest: isLikelyTestCenter(c.name, c.slug),
  }));
}
