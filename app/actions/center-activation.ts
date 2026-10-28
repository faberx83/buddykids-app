"use server";

// TRAMA — PORTALE CENTRI V2, FASE 1: azioni dell'attivazione (27/10/2026).
// Le transizioni passano SEMPRE dalle funzioni SECURITY DEFINER:
// - centro: center_claim_onboarding (LEAD → CLAIMED, fatto qui al primo
//   invio) e center_submit_onboarding (→ SUBMITTED), di migration_09;
// - Admin: admin_set_activation_check e admin_approve_center_activation
//   (migration_55), admin_review_center_onboarding('request_changes') di
//   migration_09 per "chiedi una modifica".
// "Invia a TRAMA" si accetta solo con i 5 controlli del profilo a posto,
// ricalcolati qui lato server (mai fidarsi del pulsante).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";
import { getCentersForActivation, getMyCenterActivation } from "@/lib/data/center-activation";
import { activationView } from "@/lib/centers/activation";
import { emailActivationDecision, emailActivationSubmitted } from "@/lib/centers/notify-center";

const PARTNER_PATHS = ["/center", "/center/profile"];
const ADMIN_PATH = "/admin/centri-attivazione";

function revalidateAll() {
  for (const p of PARTNER_PATHS) revalidatePath(p);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin/one/onboarding");
}

/** Il centro conferma le regole di cancellazione (riusa la voce della checklist). */
export async function confirmCancellationRulesAction(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { centerDbId } = await getCenterContext();
  if (!centerDbId) return { error: "Nessun centro collegato a questo account" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };
  const { error } = await supabase
    .from("center_onboarding_checklist_completions")
    .upsert(
      {
        center_id: centerDbId,
        item_key: "cancellation_policy_set",
        completed: true,
        completed_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "center_id,item_key" }
    );
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** "Invia a TRAMA per la verifica". */
export async function submitActivationAction(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { centerDbId } = await getCenterContext();
  if (!centerDbId) return { error: "Nessun centro collegato a questo account" };
  const mine = await getMyCenterActivation(centerDbId);
  if (!mine) return { error: "Non riusciamo a leggere il profilo del centro, riprova." };
  const view = activationView(mine.facts);
  if (!view.canSubmit) {
    const missing = view.checks.filter((c) => !c.done).map((c) => c.label.toLowerCase());
    return { error: missing.length > 0 ? `Manca ancora: ${missing.join(", ")}.` : "Il profilo non si può inviare adesso." };
  }
  const supabase = await createClient();
  if (view.needsClaim) {
    const { error } = await supabase.rpc("center_claim_onboarding", { p_center_id: centerDbId });
    if (error) return { error: error.message };
  }
  const { error } = await supabase.rpc("center_submit_onboarding", { p_center_id: centerDbId, p_note: null });
  if (error) return { error: error.message };
  revalidateAll();
  await emailActivationSubmitted({ centerName: mine.name, city: mine.city });
  return {};
}

// ─── Admin ───────────────────────────────────────────────────────────

export async function setActivationCheckAction(
  centerId: string,
  check: "referent" | "activities",
  value: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_activation_check", { p_center_id: centerId, p_check: check, p_value: value });
  if (error) {
    if (/function .* does not exist|Could not find the function/i.test(error.message)) {
      return { error: "Serve la migration 55 (verifiche di attivazione)." };
    }
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

async function centerName(centerId: string): Promise<string> {
  const all = await getCentersForActivation();
  return all.find((c) => c.centerId === centerId)?.name ?? "Il vostro centro";
}

export async function approveActivationAction(centerId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_center_activation", { p_center_id: centerId, p_note: null });
  if (error) {
    if (/function .* does not exist|Could not find the function/i.test(error.message)) {
      return { error: "Serve la migration 55 (verifiche di attivazione)." };
    }
    return { error: error.message };
  }
  revalidateAll();
  await emailActivationDecision({ centerId, centerName: await centerName(centerId), decision: "approved" });
  return {};
}

export async function requestActivationChangesAction(centerId: string, note: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const text = (note ?? "").trim();
  if (!text) return { error: "Scrivi cosa va modificato: il centro lo vede nel portale e nell'email." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_center_onboarding", {
    p_center_id: centerId,
    p_decision: "request_changes",
    p_note: text,
  });
  if (error) return { error: error.message };
  revalidateAll();
  await emailActivationDecision({ centerId, centerName: await centerName(centerId), decision: "changes", note: text });
  return {};
}
