"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { findPossibleDuplicates, getCandidacyStatusPublic, normalizeDedupeKey, PublicCandidacyStatus } from "@/lib/data/center-leads";
import { CenterLeadDemandContext, CenterLeadItem, CenterLeadStatus } from "@/lib/types";
import { createCenterAndAssignAction, CreateCenterInput, CreateCenterResult } from "@/app/actions/admin";

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

// ════════════════════════════════════════════════════════════════
// Migrazione 21 — "Candidati come centro" (Fabrizio: "il registrati deve
// essere un 'candidati' per cui deve far partire processo di onboarding").
// Vedi supabase/migration_21_center_candidacy.sql per lo schema e il
// ragionamento completo di design.
// ════════════════════════════════════════════════════════════════

export interface CenterCandidacyInput {
  centerName: string;
  locality?: string;
  description?: string;
  phone?: string;
  email: string;
}

// Form pubblico "Candidati" (/auth/candidati) — NESSUN account viene creato
// qui, solo una riga center_leads con lead_type='self_candidacy'. Usa il
// service client (bypassa le RLS) perché chi compila il form non ha ancora
// alcuna sessione: le RLS di insert esistenti richiedono suggested_by =
// auth.uid(), impossibile per un candidato anonimo (per questo
// suggested_by resta null qui, vedi migration_21_center_candidacy.sql).
export async function submitCenterCandidacyAction(
  input: CenterCandidacyInput
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.centerName.trim()) return { error: "Inserisci il nome del centro" };
  if (!input.email.trim()) return { error: "Inserisci un'email di contatto" };

  const supabase = createServiceClient();
  if (!supabase) return { error: "Servizio momentaneamente non disponibile. Riprova più tardi o scrivici direttamente." };

  const dedupeKey = normalizeDedupeKey(input.centerName, input.locality);

  const { data, error } = await supabase
    .from("center_leads")
    .insert({
      suggested_name: input.centerName.trim(),
      suggested_locality: input.locality?.trim() || null,
      suggested_contact: input.description?.trim() || null,
      demand_context: {},
      dedupe_key: dedupeKey,
      status: "suggested",
      lead_type: "self_candidacy",
      candidate_email: input.email.trim(),
      candidate_phone: input.phone?.trim() || null,
      reward_status: "not_applicable",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message || "Errore nell'invio della candidatura" };
  revalidatePath("/admin/center-leads");
  return { id: data.id };
}

// Letta SENZA login dalla pagina di conferma (/auth/candidati/conferma/[id])
// — sola lettura, 3 campi non sensibili (vedi lib/data/center-leads.ts).
export async function getCandidacyStatusAction(id: string): Promise<PublicCandidacyStatus | null> {
  return getCandidacyStatusPublic(id);
}

// Admin approva un'autocandidatura: crea il centro riusando la STESSA azione
// già esistente della pagina /admin/centers (createCenterAndAssignAction,
// solo prefillata dai dati della candidatura), poi collega il lead al
// centro appena creato (status='claimed'). NESSUNA creazione di account
// qui — se il candidato non si è ancora registrato, createCenterAndAssignAction
// restituisce il suo "warning" normale (comportamento esistente, invariato):
// il centro viene comunque creato e il lead comunque collegato, perché il
// trigger handle_new_user() esteso (migration_21) assegnerà
// automaticamente role='center_admin' quando il candidato si registrerà con
// la stessa email indicata in candidatura.
export async function approveCandidacyAction(leadId: string, centerInput: CreateCenterInput): Promise<CreateCenterResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const result = await createCenterAndAssignAction(centerInput);
  if (result.error || !result.centerId) return result;

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("center_leads")
    .update({
      status: "claimed",
      claimed_center_id: result.centerId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    return {
      ...result,
      warning: `Centro creato, ma non è stato possibile aggiornare lo stato della candidatura: ${updateError.message}`,
    };
  }

  revalidatePath("/admin/center-leads");
  return result;
}
