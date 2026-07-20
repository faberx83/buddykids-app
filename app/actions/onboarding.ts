"use server";

// TRAMA ONE Build Sprint 1 — Server Actions per l'onboarding Centro
// (Partner) e la revisione Admin. Le transizioni di stato passano SEMPRE
// dalle funzioni SECURITY DEFINER definite in
// supabase/migration_09_center_onboarding.sql (center_claim_onboarding,
// center_submit_onboarding, admin_review_center_onboarding) via
// supabase.rpc(...) — mai un UPDATE diretto su center_onboarding_state, che
// non ha nessuna policy RLS di scrittura per costruzione. Stesso pattern di
// return `{ error?: string }` già usato in app/actions/family.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { isKnownChecklistItem } from "@/lib/onboarding/checklist-registry";

const CENTER_ONBOARDING_PATH = "/center/one/onboarding";
const ADMIN_ONBOARDING_PATH = "/admin/one/onboarding";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function claimOnboardingAction(centerId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.rpc("center_claim_onboarding", { p_center_id: centerId });
  if (error) return { error: error.message };

  revalidatePath(CENTER_ONBOARDING_PATH);
  return {};
}

export async function submitOnboardingAction(centerId: string, note?: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.rpc("center_submit_onboarding", {
    p_center_id: centerId,
    p_note: note?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(CENTER_ONBOARDING_PATH);
  revalidatePath(ADMIN_ONBOARDING_PATH);
  return {};
}

export async function toggleChecklistItemAction(
  centerId: string,
  itemKey: string,
  completed: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!isKnownChecklistItem(itemKey)) return { error: "Item checklist sconosciuto" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("center_onboarding_checklist_completions").upsert(
    {
      center_id: centerId,
      item_key: itemKey,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_by: user.id,
    },
    { onConflict: "center_id,item_key" }
  );
  if (error) return { error: error.message };

  revalidatePath(CENTER_ONBOARDING_PATH);
  return {};
}

export async function submitIdentityVerificationAction(
  centerId: string,
  note: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!note.trim()) return { error: "Inserisci una nota per la verifica identità" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  // Non un upsert incondizionato: se esiste già una riga "verified"/
  // "rejected" la policy RLS di update-owner blocca la scrittura (solo
  // "pending" è modificabile dal proprietario) — l'errore Postgres risalito
  // qui va mostrato com'è, è già un messaggio corretto per l'utente
  // ("nuova riga violerebbe la row-level security policy" → tradotto sotto).
  const { data: existing } = await supabase
    .from("center_identity_verifications")
    .select("id, status")
    .eq("center_id", centerId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("center_identity_verifications")
      .insert({ center_id: centerId, note: note.trim(), status: "pending" });
    if (error) return { error: error.message };
  } else if (existing.status === "pending") {
    const { error } = await supabase
      .from("center_identity_verifications")
      .update({ note: note.trim() })
      .eq("center_id", centerId);
    if (error) return { error: error.message };
  } else {
    return { error: "La verifica identità è già stata esaminata dall'Admin — non può essere modificata." };
  }

  revalidatePath(CENTER_ONBOARDING_PATH);
  return {};
}

export async function adminReviewOnboardingAction(
  centerId: string,
  decision: "approve" | "request_changes" | "suspend",
  note?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.rpc("admin_review_center_onboarding", {
    p_center_id: centerId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(ADMIN_ONBOARDING_PATH);
  revalidatePath(CENTER_ONBOARDING_PATH);
  return {};
}

export async function adminReviewIdentityVerificationAction(
  centerId: string,
  decision: "verified" | "rejected"
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("center_identity_verifications")
    .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("center_id", centerId);
  if (error) return { error: error.message };

  revalidatePath(ADMIN_ONBOARDING_PATH);
  revalidatePath(CENTER_ONBOARDING_PATH);
  return {};
}
