"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { findPossibleDuplicates, normalizeDedupeKey } from "@/lib/data/center-leads";
import { CenterLeadDemandContext, CenterLeadItem, CenterLeadStatus } from "@/lib/types";

// Un genitore segnala un centro non ancora iscritto (TRAMA ONE Build
// Sprint 5, J11 nella fonte di design). Crea SEMPRE una riga in
// center_leads, MAI un'attività pubblica o prenotabile (DDL-023) — nessun
// listing viene creato da questa azione.
export async function suggestCenterLeadAction(
  suggestedName: string,
  suggestedLocality: string | undefined,
  suggestedContact: string | undefined,
  demandContext: CenterLeadDemandContext
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!suggestedName.trim()) return { error: "Inserisci il nome del centro che vuoi segnalare" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const dedupeKey = normalizeDedupeKey(suggestedName, suggestedLocality);

  const { error } = await supabase.from("center_leads").insert({
    suggested_name: suggestedName.trim(),
    suggested_locality: suggestedLocality?.trim() || null,
    suggested_contact: suggestedContact?.trim() || null,
    demand_context: demandContext,
    dedupe_key: dedupeKey,
    status: "suggested",
    suggested_by: user.id,
    reward_status: "not_applicable",
  });

  if (error) return { error: error.message };
  revalidatePath("/center-leads");
  revalidatePath("/admin/center-leads");
  return {};
}

// Solo l'Admin piattaforma (RLS lo impone comunque lato database) cambia lo
// stato durante il triage: qualified/contacted/rejected/expired. "claimed"
// ha un'azione dedicata sotto (richiede anche il collegamento al centro).
export async function updateCenterLeadStatusAction(
  id: string,
  status: Exclude<CenterLeadStatus, "claimed">,
  adminNote?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("center_leads")
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/center-leads");
  return {};
}

// Cerca altri lead con lo stesso dedupe_key (Must, §B.2.2) — usata dalla
// coda Admin per proporre possibili duplicati durante il triage, prima di
// decidere se aggregare con markCenterLeadDuplicateAction. Sola lettura.
export async function findPossibleDuplicateLeadsAction(
  dedupeKey: string,
  excludeId: string
): Promise<{ leads: CenterLeadItem[] }> {
  const leads = await findPossibleDuplicates(dedupeKey, excludeId);
  return { leads };
}

// Marca un lead come duplicato di un altro già esistente (aggrega la
// domanda, l'attribution economica resta sul lead canonico — AC-049-04).
export async function markCenterLeadDuplicateAction(id: string, duplicateOfId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (id === duplicateOfId) return { error: "Un lead non può essere duplicato di se stesso" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("center_leads")
    .update({
      status: "qualified",
      duplicate_of: duplicateOfId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/center-leads");
  return {};
}

// Claim: il centro segnalato ha completato l'onboarding reale (state
// machine center_onboarding_state esistente, invariata) ed è collegato a
// posteriori a questo lead per misurare la conversione del canale referral.
// Non crea né pubblica nulla: si limita a collegare due entità già esistenti.
export async function claimCenterLeadAction(id: string, centerId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("center_leads")
    .update({
      status: "claimed",
      claimed_center_id: centerId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/center-leads");
  revalidatePath("/center-leads");
  return {};
}

// Reward/commission: SOLO annotazione manuale (scope Sprint 5, "shadow
// mode/manuale, mai automatico prima del ledger reale"). Non calcola né
// eroga alcun importo reale — è una nota per il monitoraggio manuale di
// Finance/Growth, coerente con l'assenza di infrastruttura di pagamento nel
// repository (CORE_DOMAIN_SOURCE_OF_TRUTH.md §10).
export async function markCenterLeadRewardAction(
  id: string,
  rewardStatus: "pending_manual_review" | "marked_eligible_manual" | "marked_paid_manual_offline",
  rewardNote: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!rewardNote.trim()) return { error: "Aggiungi una nota descrittiva (nessun importo è calcolato automaticamente)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("center_leads")
    .update({
      reward_status: rewardStatus,
      reward_note: rewardNote.trim(),
      reward_marked_by: user.id,
      reward_marked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/center-leads");
  revalidatePath("/center-leads");
  return {};
}
