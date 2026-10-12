"use server";

// TRAMA — RADAR (12/10/2026). Azioni dopo la revisione dell'utente.
//
// - saveCommunityDiscoveryAction: "Salva scoperta". Ri-valida lato server i
//   dati (anche quelli corretti dall'utente), ricontrolla i doppioni e solo
//   allora crea UNA Community Discovery, collega l'invio e registra un
//   segnale di interesse PRIVATO.
// - linkExistingAction: "È questa" / "L'abbiamo trovata su TRAMA": nessun
//   nuovo contenuto, solo collegamento dell'invio e segnale di interesse.
// - abandonSubmissionAction: l'utente chiude senza salvare.
// - reportAnywayAction: "Segnala comunque" su un contenuto rifiutato →
//   solo un feedback interno (beta_feedback), mai pubblicato.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { REAL_DISCOVERY_LEADS } from "@/lib/discovery/real-dataset";
import { loadRadarCandidates } from "@/lib/data/radar";
import { buildDedupeKey, findCandidateMatches } from "@/lib/radar/match";
import { validateExtracted } from "@/lib/radar/validate";
import { EXTRACTED_FIELDS, type CandidateKind, type FieldProvenance, type RadarExtractedData, type RadarWarning } from "@/lib/radar/types";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import type { KnownProductEvent } from "@/lib/telemetry/known-events";

type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

interface SubmissionRow {
  id: string;
  outcome: string;
  relevance_status: string;
  extracted: Partial<RadarExtractedData> | null;
}

async function authorize() {
  if (!isSupabaseConfigured) return { error: "Servizio non disponibile." } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Accedi per continuare." } as const;
  const enabled = await resolveFeatureFlag({ flagName: "RADAR_ENABLED", userId: user.id });
  if (!enabled) return { error: "Funzione non ancora disponibile per il tuo account." } as const;
  return { supabase, userId: user.id } as const;
}

async function loadOwnPendingSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  submissionId: string
): Promise<SubmissionRow | null> {
  const { data } = await supabase
    .from("discovery_submissions")
    .select("id, outcome, relevance_status, extracted")
    .eq("id", submissionId)
    .eq("submitted_by", userId)
    .maybeSingle();
  const row = data as SubmissionRow | null;
  return row && row.outcome === "pending" ? row : null;
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  event: KnownProductEvent,
  detail: string
) {
  await persistProductEvent({ event, correlationId: generateCorrelationId(), tenant: "family", detail }, { supabase, userId });
}

/** Provenienza per campo: uguale a quanto estratto → "extracted", altrimenti "user_confirmed". */
async function computeProvenance(
  extracted: Partial<RadarExtractedData>,
  final: RadarExtractedData
): Promise<Record<string, FieldProvenance>> {
  const out: Record<string, FieldProvenance> = {};
  for (const key of EXTRACTED_FIELDS) {
    if (final[key] === null) continue;
    out[key] = extracted[key] === final[key] ? "extracted" : "user_confirmed";
  }
  return out;
}

async function targetExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: CandidateKind,
  id: string
): Promise<boolean> {
  if (kind === "curated") return REAL_DISCOVERY_LEADS.some((l) => l.id === id);
  if (kind === "activity") {
    const { data } = await supabase.from("activities").select("id").eq("id", id).maybeSingle();
    return !!data;
  }
  const { data } = await supabase.from("community_discoveries").select("id").eq("id", id).eq("status", "visible").maybeSingle();
  return !!data;
}

function outcomeFor(kind: CandidateKind): "matched_activity" | "matched_curated" | "matched_community" {
  return kind === "activity" ? "matched_activity" : kind === "curated" ? "matched_curated" : "matched_community";
}

async function linkSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  submissionId: string,
  kind: CandidateKind,
  id: string
) {
  await supabase
    .from("discovery_submissions")
    .update({
      outcome: outcomeFor(kind),
      activity_id: kind === "activity" ? id : null,
      curated_lead_id: kind === "curated" ? id : null,
      community_discovery_id: kind === "community" ? id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("submitted_by", userId);
  await supabase.from("interest_signals").insert({
    user_id: userId,
    target_type: kind,
    target_id: id,
    signal_type: "imported",
    visibility: "private",
    source_submission_id: submissionId,
  });
}

export async function linkExistingAction(
  submissionId: string,
  kind: CandidateKind,
  targetId: string
): Promise<ActionResult<{ kind: CandidateKind; id: string }>> {
  const auth = await authorize();
  if ("error" in auth) return { ok: false, error: auth.error ?? "Errore." };
  const { supabase, userId } = auth;
  if (kind !== "activity" && kind !== "curated" && kind !== "community") return { ok: false, error: "Richiesta non valida." };

  const submission = await loadOwnPendingSubmission(supabase, userId, submissionId);
  if (!submission) return { ok: false, error: "Questo contenuto è già stato gestito." };
  if (submission.relevance_status === "not_relevant") return { ok: false, error: "Questo contenuto non è collegabile." };
  if (!(await targetExists(supabase, kind, targetId))) return { ok: false, error: "La scheda non è più disponibile." };

  await linkSubmission(supabase, userId, submissionId, kind, targetId);
  await logEvent(supabase, userId, "radar_existing_activity_matched", `${kind}:${targetId}`);
  return { ok: true, kind, id: targetId };
}

export async function saveCommunityDiscoveryAction(
  submissionId: string,
  fields: Partial<RadarExtractedData>
): Promise<ActionResult<{ kind: CandidateKind; id: string; created: boolean }>> {
  const auth = await authorize();
  if ("error" in auth) return { ok: false, error: auth.error ?? "Errore." };
  const { supabase, userId } = auth;

  const submission = await loadOwnPendingSubmission(supabase, userId, submissionId);
  if (!submission) return { ok: false, error: "Questo contenuto è già stato gestito." };
  // Gate (§2): niente contenuto pubblico da un invio rifiutato o ancora in dubbio.
  if (submission.relevance_status !== "relevant") {
    return { ok: false, error: "Conferma prima che si tratta di un'attività per bambini o famiglie." };
  }

  // I dati corretti dall'utente passano dalla stessa validazione del modello.
  const warnings = new Set<RadarWarning>();
  const final = validateExtracted(fields, new Date().toISOString().slice(0, 10), warnings);
  if (!final.title || final.title.length < 2) return { ok: false, error: "Serve almeno il nome dell'attività." };

  // Ricontrollo dei doppioni lato server, sui dati finali (mai fidarsi del client).
  const matches = findCandidateMatches(final, await loadRadarCandidates(supabase));
  const strong = matches.find((m) => m.strong);
  if (strong) {
    await linkSubmission(supabase, userId, submissionId, strong.kind, strong.id);
    await logEvent(supabase, userId, "radar_duplicate_detected", `${strong.kind}:${strong.id}`);
    return { ok: true, kind: strong.kind, id: strong.id, created: false };
  }

  const provenance = await computeProvenance(submission.extracted ?? {}, final);
  const { data: created, error } = await supabase
    .from("community_discoveries")
    .insert({
      title: final.title,
      organizer_name: final.organizerName,
      category: final.category,
      short_description: final.shortDescription,
      age_min: final.ageMin,
      age_max: final.ageMax,
      start_date: final.startDate,
      end_date: final.endDate,
      date_text_raw: final.dateTextRaw,
      schedule_text: final.scheduleText,
      location_name: final.locationName,
      address: final.address,
      comune: final.comune,
      price: final.price,
      price_unit: final.priceUnit,
      contact_phone: final.contactPhone,
      contact_email: final.contactEmail,
      website_url: final.websiteUrl,
      social_url: final.socialUrl,
      registration_info: final.registrationInfo,
      field_provenance: provenance,
      dedupe_key: buildDedupeKey(final),
      created_by: userId,
      status: "visible",
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[radar] creazione community discovery fallita:", error?.message);
    return { ok: false, error: "Non siamo riusciti a salvare la scoperta. Riprova." };
  }
  const id = (created as { id: string }).id;

  await supabase
    .from("discovery_submissions")
    .update({ outcome: "created_community", community_discovery_id: id, updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("submitted_by", userId);
  await supabase.from("interest_signals").insert({
    user_id: userId,
    target_type: "community",
    target_id: id,
    signal_type: "imported",
    visibility: "private",
    source_submission_id: submissionId,
  });

  await logEvent(supabase, userId, "radar_community_discovery_created", id);
  if (Object.values(provenance).includes("user_confirmed")) {
    await logEvent(supabase, userId, "radar_user_corrected_extraction", id);
  }
  revalidatePath("/nextgen/search");
  return { ok: true, kind: "community", id, created: true };
}

export async function abandonSubmissionAction(submissionId: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return { ok: false, error: auth.error ?? "Errore." };
  const { supabase, userId } = auth;
  await supabase
    .from("discovery_submissions")
    .update({ outcome: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("submitted_by", userId)
    .eq("outcome", "pending");
  return { ok: true };
}

export async function reportAnywayAction(submissionId: string, message: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return { ok: false, error: auth.error ?? "Errore." };
  const { supabase, userId } = auth;
  const { data } = await supabase
    .from("discovery_submissions")
    .select("id, outcome")
    .eq("id", submissionId)
    .eq("submitted_by", userId)
    .maybeSingle();
  const row = data as { id: string; outcome: string } | null;
  if (!row || row.outcome !== "rejected") return { ok: false, error: "Questo contenuto è già stato gestito." };

  const text = message.trim().slice(0, 500) || "(nessun commento)";
  const { error } = await supabase.from("beta_feedback").insert({
    parent_id: userId,
    app_source: "genitori",
    area: "radar",
    page_path: "/nextgen/search",
    message: `Radar — contenuto rifiutato segnalato comunque (invio ${submissionId}): ${text}`,
    status: "nuovo",
  });
  if (error) return { ok: false, error: "Non siamo riusciti a inviare la segnalazione." };
  await supabase
    .from("discovery_submissions")
    .update({ outcome: "reported_anyway", updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("submitted_by", userId);
  return { ok: true };
}
