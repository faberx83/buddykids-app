"use server";

// TRAMA — LINK BETA PIÙ SICURO (20/11/2026). Chi ha già un account e apre un
// link d'invito beta entra nella beta (vedi lib/beta-cohorts/code.ts).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { joinBetaCohortWithCode } from "@/lib/beta-cohorts/membership";
import type { BetaJoinOutcome } from "@/lib/beta-cohorts/code";

export async function joinBetaWithCodeAction(code: string): Promise<{ outcome: BetaJoinOutcome }> {
  if (!isSupabaseConfigured) return { outcome: "error" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { outcome: "error" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "parent") return { outcome: "not_parent" };
  const outcome = await joinBetaCohortWithCode(user.id, code);
  // Cambia la coorte, cambiano le funzioni accese: si rinfresca tutta l'app.
  if (outcome === "joined") revalidatePath("/nextgen", "layout");
  return { outcome };
}
