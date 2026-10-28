// TRAMA — PORTALE CENTRI V2 (27/10/2026): PARTNER_V2_ENABLED risolto per
// l'utente collegato (gestore o Admin), lato server. Errore o niente
// sessione → false: si resta sul portale di prima.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { PARTNER_V2_FLAG } from "@/lib/centers/activation";
import { PARTNER_SHELL_FLAG } from "@/lib/centers/partner-shell";

export async function partnerV2EnabledForCurrentUser(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return await resolveFeatureFlag({ flagName: PARTNER_V2_FLAG, userId: user.id, role: profile?.role ?? null, tenant: "center" });
  } catch {
    return false;
  }
}

// Guscio V2 del portale (28/10/2026, PARTNER_SHELL_V2_ENABLED): stessa
// risoluzione, flag diverso. Usato da Oggi (/center) e da Centro (/center/centro).
export async function partnerShellEnabledForCurrentUser(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return await resolveFeatureFlag({ flagName: PARTNER_SHELL_FLAG, userId: user.id, role: profile?.role ?? null, tenant: "center" });
  } catch {
    return false;
  }
}
