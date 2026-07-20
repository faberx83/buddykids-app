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
  revalidatePath("/one");
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
  revalidatePath("/one");
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
  revalidatePath("/one");
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
  revalidatePath("/one");
  return {};
}
