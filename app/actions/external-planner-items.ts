"use server";

// TRAMA — EXTERNAL PLANNER ITEMS · Server Actions.
//
// Stesso pattern di app/actions/curated-favorites.ts: ogni azione fa il
// proprio auth.getUser() (via il data layer), è "best effort" per la sola
// parte analytics (mai bloccante per l'utente), e invalida SOLO le pagine
// realmente interessate (Planner, Scopri — quest'ultima solo per l'azione
// "Aggiungi da Scoperta", sezione 15 del task: badge "✓ Nel Planner").

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";
import {
  createExternalPlannerItem,
  updateExternalPlannerItem,
  softDeleteExternalPlannerItem,
  buildExternalPlannerItemInputFromCuratedLead,
  type ExternalPlannerItemInput,
  type MutationResult,
} from "@/lib/data/external-planner-items";
import { REAL_DISCOVERY_LEADS } from "@/lib/discovery/real-dataset";

async function logItemEvent(event: "external_planner_item_created" | "external_planner_item_updated" | "external_planner_item_deleted", itemId: string, sourceType: string) {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Sezione 25 del task: "No note/title/location nei payload. Solo
    // IDs/type/source se necessari." — detail = "source_type:item_id".
    await persistProductEvent(
      { event, correlationId: generateCorrelationId(), detail: `${sourceType}:${itemId}` },
      { supabase, userId: user.id }
    );
  } catch {
    // silenzioso, per costruzione — stesso principio di app/actions/curated-favorites.ts.
  }
}

export async function createExternalPlannerItemAction(input: ExternalPlannerItemInput): Promise<MutationResult> {
  const result = await createExternalPlannerItem(input, { sourceType: "manual" });
  if (!result.error && result.id) {
    await logItemEvent("external_planner_item_created", result.id, "manual");
    revalidatePath("/nextgen/planner");
  }
  return result;
}

export async function updateExternalPlannerItemAction(itemId: string, input: ExternalPlannerItemInput): Promise<MutationResult> {
  const result = await updateExternalPlannerItem(itemId, input);
  if (!result.error) {
    await logItemEvent("external_planner_item_updated", itemId, "manual");
    revalidatePath("/nextgen/planner");
  }
  return result;
}

export async function deleteExternalPlannerItemAction(itemId: string): Promise<MutationResult> {
  const result = await softDeleteExternalPlannerItem(itemId);
  if (!result.error) {
    await logItemEvent("external_planner_item_deleted", itemId, "manual");
    revalidatePath("/nextgen/planner");
  }
  return result;
}

// Sezione 7 del task: "Scoperta TRAMA → Aggiungi al Planner → conferma/
// completa i dati necessari → External Planner Item creato → Planner
// aggiornato." Il "conferma/completa" (scelta bambini, eventuale
// correzione date) avviene lato client PRIMA di chiamare questa azione
// (dialog inline, stesso pattern di DiscoveryProposeInviteDialog) — questa
// azione riceve già kidIds scelti, non fa alcuna UI.
export async function addCuratedLeadToPlannerAction(curatedLeadId: string, kidIds: string[]): Promise<MutationResult> {
  const lead = REAL_DISCOVERY_LEADS.find((l) => l.id === curatedLeadId);
  if (!lead) return { error: "Scoperta non trovata." };

  const input = buildExternalPlannerItemInputFromCuratedLead(lead, kidIds);
  const result = await createExternalPlannerItem(input, {
    sourceType: "curated_discovery",
    sourceRef: curatedLeadId,
    organizerSnapshot: lead.organizerName,
  });

  if (!result.error && result.id) {
    await logItemEvent("external_planner_item_created", result.id, "curated_discovery");
    if (isSupabaseConfigured) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await persistProductEvent(
            { event: "curated_added_to_planner", correlationId: generateCorrelationId(), detail: curatedLeadId },
            { supabase, userId: user.id }
          );
        }
      } catch {
        // silenzioso, per costruzione.
      }
    }
    revalidatePath("/nextgen/planner");
    revalidatePath("/nextgen/search");
  }

  return result;
}
