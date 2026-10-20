"use server";

// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026): preferenze dal Profilo e
// "Mandamelo adesso" per provarlo subito (solo a sé stessi). Tutto dietro la
// release "buongiorno-trama" (DAILY_BRIEFING_ENABLED).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { DAILY_BRIEFING_FLAG, runDailyBriefing } from "@/lib/data/daily-briefing";

async function currentUserWithFlag() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const on = await resolveFeatureFlag({ flagName: DAILY_BRIEFING_FLAG, userId: user.id, tenant: "family" }).catch(() => false);
  return on ? { supabase, user } : null;
}

export async function updateDailyBriefingAction(input: { push?: boolean; email?: boolean }): Promise<{ error?: string }> {
  const ctx = await currentUserWithFlag();
  if (!ctx) return { error: "Il buongiorno non è disponibile per il tuo account" };
  const update: Record<string, boolean> = {};
  if (typeof input.push === "boolean") update.daily_briefing_push = input.push;
  if (typeof input.email === "boolean") update.daily_briefing_email = input.email;
  if (Object.keys(update).length === 0) return {};
  const { error } = await ctx.supabase.from("profiles").update(update).eq("id", ctx.user.id);
  if (error) return { error: "Non sono riuscito a salvare, riprova" };
  revalidatePath("/nextgen/profile/impostazioni/preferenze");
  return {};
}

export type SendBriefingNowResult =
  | { ok: true; push: boolean; email: boolean; empty: boolean }
  | { ok: false; error: string };

export async function sendDailyBriefingNowAction(): Promise<SendBriefingNowResult> {
  const ctx = await currentUserWithFlag();
  if (!ctx) return { ok: false, error: "Il buongiorno non è disponibile per il tuo account" };
  const service = createServiceClient();
  if (!service) return { ok: false, error: "Invio non disponibile in questo momento" };
  const r = await runDailyBriefing(service, new Date(), { onlyUserId: ctx.user.id, source: "prova" });
  if (!r.ready) return { ok: false, error: "Manca l'aggiornamento del database (migration 45)" };
  if (r.candidates === 0) return { ok: false, error: "Attiva prima il telefono o l'email qui sopra" };
  return { ok: true, push: r.pushes > 0, email: r.emails > 0, empty: r.empty > 0 };
}
