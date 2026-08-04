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
  // CONTROLLED BETA EXPERIENCE GATE (§7-14) — propagati dal registry (vedi
  // WalkthroughStepDefinition) fino al client Spotlight, che non deve
  // importare il registry direttamente: stesso principio di incapsulamento
  // già seguito per WalkthroughCard (riceve solo WalkthroughProgressSummary).
  spotlightTarget?: string;
  spotlightRoute?: string;
  // Visual Acceptance Gate (§15, DEC-69) — vedi WalkthroughStepDefinition
  // per il motivo: link esplicito nel badge "target non trovato" quando lo
  // step successivo richiede di aprire un'altra pagina.
  spotlightMissingHint?: { suffix: string; label: string };
  // Visual Acceptance Gate (§15, DEC-71) — vedi WalkthroughStepDefinition per
  // il motivo: quando true, il completamento richiede il pulsante esplicito
  // "Ho finito, continua →" invece del primo click dentro il target.
  spotlightManualAdvance?: boolean;
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
    spotlightTarget: s.spotlightTarget,
    spotlightRoute: s.spotlightRoute,
    spotlightMissingHint: s.spotlightMissingHint,
    spotlightManualAdvance: s.spotlightManualAdvance,
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

/**
 * TRAMA ONE Build Sprint 6 (E11 + hardening walkthrough, task #418) —
 * conteggio dei riavvii del percorso, l'unica metrica che tutorial_progress
 * non può dare (restartWalkthroughAction cancella le righe dell'utente, vedi
 * app/actions/walkthrough.ts, quindi un riavvio è invisibile allo snapshot
 * corrente ma resta come evento storico in product_events). SEMPRE
 * best-effort: se product_events non esiste ancora (migration_20 non
 * applicata) o la query fallisce per qualunque motivo, ritorna `null`
 * (interpretato dal chiamante come "N/D"), mai un errore propagato — stessa
 * filosofia non-bloccante di lib/telemetry/events.ts::persistProductEvent.
 */
export async function getWalkthroughRestartCount(tutorialKey: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("product_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "walkthrough_restarted")
      .eq("detail", tutorialKey);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
