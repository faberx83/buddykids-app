"use server";

// TRAMA ONE Build Sprint 1 — Server Actions per il motore Walkthrough
// generico. Scrittura diretta su public.tutorial_progress (RLS "auth.uid() =
// user_id" per insert/update, vedi migration_09_center_onboarding.sql) —
// non serve una funzione SECURITY DEFINER qui: a differenza della state
// machine Center, non c'è alcuna decisione di terzi da proteggere (l'utente
// avanza solo il proprio percorso).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { isKnownTutorial, getTutorialDefinition } from "@/lib/walkthrough/registry";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";

// TRAMA ONE Build Sprint 6 (E11) — una Server Action non ha un
// correlationId "di richiesta" in ingresso come un Server Component (i tre
// layout /one ne generano uno all'inizio del render): ogni chiamata a
// queste action ne genera quindi uno nuovo, che correla comunque tutti gli
// eventi (qui solo uno per chiamata) e le eventuali righe DB scritte nella
// stessa azione — sufficiente per il tracciamento "quando/quale step",
// senza introdurre propagazione cross-richiesta (fuori scope, vedi
// lib/telemetry/correlation.ts).
function walkthroughCorrelationId(): string {
  return generateCorrelationId();
}

// TRAMA ONE Build Sprint 6 (backlog vincolante P2, TC-N414/N415, DEC-50) —
// il motore è generico per costruzione (registry.ts ospita percorsi sia
// Parent sia Partner, e in futuro Admin) ma finora ogni action revalidava
// SOLO "/one" (il portale Parent), mai "/center/one" (Partner, aggiunto in
// Sprint 2) né "/admin/one". Non è la causa del bug intermittente TC-N414/
// N415 (risolto a monte in WalkthroughCard.tsx: le pagine /one* usano già
// cookies() quindi Next.js le rende dinamiche di default, bypassando la
// Full Route Cache indipendentemente da revalidatePath), ma resta
// un'inconsistenza reale da chiudere: un futuro cambio di rendering
// strategy per una di queste route riesumerebbe silenziosamente lo stesso
// sintomo. Revalidare tutte e tre le route è innocuo (revalidatePath su una
// route non renderizzata di recente è un no-op) e corretto per un motore
// pensato per essere riusato da più tenant.
function revalidateAllWalkthroughPortals() {
  revalidatePath("/one");
  revalidatePath("/center/one");
  revalidatePath("/admin/one");
  // FINAL PRE-FREEZE WAVE (08/09/2026) — i due carousel di benvenuto
  // (parent_beta_onboarding, partner_beta_onboarding) e i due tour guidati
  // (discover_book_parent, activity_creation_partner) vivono ORA anche
  // fuori da /one* — rispettivamente in app/nextgen/layout.tsx e
  // app/center/layout.tsx (le vere Dashboard, non solo la shell /one).
  // Innocuo aggiungerle qui (stesso principio già documentato sopra: una
  // revalidatePath su una route non renderizzata di recente è un no-op) —
  // ma senza queste due righe, un "Riavvia" da Preferenze non garantiva la
  // ripartenza del carousel/tour alla PROSSIMA navigazione su /nextgen o
  // /center se quella route era già in cache.
  revalidatePath("/nextgen");
  revalidatePath("/center");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function upsertStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tutorialKey: string,
  stepKey: string,
  status: "in_progress" | "completed" | "skipped" | "not_started"
) {
  return supabase.from("tutorial_progress").upsert(
    {
      user_id: userId,
      tutorial_key: tutorialKey,
      step_key: stepKey,
      status,
      started_at: status === "in_progress" ? new Date().toISOString() : undefined,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,tutorial_key,step_key" }
  );
}

export async function startWalkthroughStepAction(
  tutorialKey: string,
  stepKey: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownTutorial(tutorialKey)) return { error: "Percorso sconosciuto" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await upsertStep(supabase, user.id, tutorialKey, stepKey, "in_progress");
  if (error) return { error: error.message };
  await persistProductEvent(
    {
      event: "walkthrough_step_started",
      correlationId: walkthroughCorrelationId(),
      detail: `${tutorialKey}/${stepKey}`,
    },
    { supabase, userId: user.id }
  );
  revalidateAllWalkthroughPortals();
  return {};
}

export async function completeWalkthroughStepAction(
  tutorialKey: string,
  stepKey: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownTutorial(tutorialKey)) return { error: "Percorso sconosciuto" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await upsertStep(supabase, user.id, tutorialKey, stepKey, "completed");
  if (error) return { error: error.message };
  await persistProductEvent(
    {
      event: "walkthrough_step_completed",
      correlationId: walkthroughCorrelationId(),
      detail: `${tutorialKey}/${stepKey}`,
    },
    { supabase, userId: user.id }
  );
  revalidateAllWalkthroughPortals();
  return {};
}

export async function skipWalkthroughStepAction(
  tutorialKey: string,
  stepKey: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownTutorial(tutorialKey)) return { error: "Percorso sconosciuto" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await upsertStep(supabase, user.id, tutorialKey, stepKey, "skipped");
  if (error) return { error: error.message };
  await persistProductEvent(
    {
      event: "walkthrough_step_skipped",
      correlationId: walkthroughCorrelationId(),
      detail: `${tutorialKey}/${stepKey}`,
    },
    { supabase, userId: user.id }
  );
  revalidateAllWalkthroughPortals();
  return {};
}

export async function restartWalkthroughAction(tutorialKey: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const definition = getTutorialDefinition(tutorialKey);
  if (!definition) return { error: "Percorso sconosciuto" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("tutorial_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("tutorial_key", tutorialKey);
  if (error) return { error: error.message };
  await persistProductEvent(
    {
      event: "walkthrough_restarted",
      correlationId: walkthroughCorrelationId(),
      detail: tutorialKey,
    },
    { supabase, userId: user.id }
  );
  revalidateAllWalkthroughPortals();
  return {};
}
