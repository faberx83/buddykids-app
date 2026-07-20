import "server-only";

// TRAMA ONE Build Sprint 1 — letture motore Walkthrough. createClient()
// (sessione utente, RLS applicata) — mai service-role: la propria
// progressione passa dalle policy "auth.uid() = user_id" definite in
// migration_09_center_onboarding.sql.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getTutorialDefinition } from "./registry";

export type WalkthroughStepStatus = "not_started" | "in_progress" | "completed" | "skipped";

export interface WalkthroughStepProgress {
  key: string;
  title: string;
  description: string;
  status: WalkthroughStepStatus;
}

export interface WalkthroughProgressSummary {
  tutorialKey: string;
  title: string;
  steps: WalkthroughStepProgress[];
  /** Prima step non completata/saltata — null se il percorso è finito. */
  currentStepKey: string | null;
}

export async function getWalkthroughProgress(
  userId: string | null,
  tutorialKey: string
): Promise<WalkthroughProgressSummary | null> {
  const definition = getTutorialDefinition(tutorialKey);
  if (!definition) return null;

  const baseSteps: WalkthroughStepProgress[] = definition.steps.map((s) => ({
    key: s.key,
    title: s.title,
    description: s.description,
    status: "not_started",
  }));

  if (!isSupabaseConfigured || !userId) {
    return { tutorialKey, title: definition.title, steps: baseSteps, currentStepKey: baseSteps[0]?.key ?? null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tutorial_progress")
    .select("step_key, status")
    .eq("user_id", userId)
    .eq("tutorial_key", tutorialKey);

  const byKey = new Map((data ?? []).map((row) => [row.step_key, row.status as WalkthroughStepStatus]));
  const steps = baseSteps.map((s) => ({ ...s, status: byKey.get(s.key) ?? "not_started" }));
  const current = steps.find((s) => s.status === "not_started" || s.status === "in_progress");

  return { tutorialKey, title: definition.title, steps, currentStepKey: current?.key ?? null };
}

export interface WalkthroughAdminStepSummary {
  key: string;
  title: string;
  completed: number;
  inProgress: number;
  skipped: number;
}

/** Admin visibility minima (A6/V4 ASSUMPTION_LOG.md): conteggio utenti per
 * step, nessun dettaglio per singolo utente. RLS "is_platform_admin()"
 * consente la SELECT su tutte le righe solo a questo ruolo — se chiamata da
 * un utente non-admin, la query ritorna 0 righe per costruzione. */
export async function getWalkthroughAdminSummary(tutorialKey: string): Promise<WalkthroughAdminStepSummary[]> {
  const definition = getTutorialDefinition(tutorialKey);
  if (!definition) return [];

  const base = definition.steps.map((s) => ({ key: s.key, title: s.title, completed: 0, inProgress: 0, skipped: 0 }));
  if (!isSupabaseConfigured) return base;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tutorial_progress")
    .select("step_key, status")
    .eq("tutorial_key", tutorialKey);

  if (!data) return base;

  const byKey = new Map(base.map((b) => [b.key, b]));
  for (const row of data) {
    const entry = byKey.get(row.step_key);
    if (!entry) continue;
    if (row.status === "completed") entry.completed += 1;
    else if (row.status === "in_progress") entry.inProgress += 1;
    else if (row.status === "skipped") entry.skipped += 1;
  }
  return base;
}
