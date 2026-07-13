"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const PLANNER_PATH = "/nextgen/planner";

// Token non indovinabile — crypto.randomUUID() è disponibile nel runtime
// Node/Edge di Next.js, nessuna nuova dipendenza.
function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createPlanShareAction(
  scopeStart: string,
  scopeEnd: string,
  label?: string
): Promise<{ url?: string; id?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!scopeStart || !scopeEnd || scopeStart > scopeEnd) return { error: "Periodo non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const token = generateToken();
  const { data, error } = await supabase
    .from("plan_shares")
    .insert({
      parent_id: user.id,
      token,
      label: label?.trim() || null,
      scope_start: scopeStart,
      scope_end: scopeEnd,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);

  const headerList = await headers();
  const host = headerList.get("host") || "";
  const proto = headerList.get("x-forwarded-proto") || "https";
  const url = host ? `${proto}://${host}/share/planner/${token}` : `/share/planner/${token}`;

  return { url, id: (data as { id: string }).id };
}

export async function revokePlanShareAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("plan_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}
