// TRAMA — RADAR (12/10/2026). POST /api/radar/analyze
//
// Riceve UN contenuto (foto, link o testo) e restituisce l'analisi:
// pertinenza, dati estratti, possibili match, passo successivo. Registra
// l'invio in discovery_submissions (solo dati estratti + impronta della
// foto: il file non viene mai salvato). NON crea mai una Community
// Discovery: quella nasce solo dopo la revisione dell'utente
// (app/actions/radar.ts#saveCommunityDiscoveryAction).
//
// Sicurezza (brief §20): utente autenticato, flag RADAR_ENABLED, rate limit
// per utente, immagine verificata dai magic byte (max 8 MB), link con
// protezione SSRF (lib/radar/url-fetch.ts), chiavi AI solo lato server.

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { analyzeDiscoveryImport } from "@/lib/radar/analyze";
import { checkImage } from "@/lib/radar/image";
import { getRadarProvider } from "@/lib/radar/provider";
import { normalizeUrl } from "@/lib/radar/url";
import { fetchUrlMetadata } from "@/lib/radar/url-fetch";
import { RADAR_SOURCE_TYPES, type RadarInput, type RadarSourceType, type UrlMetadata } from "@/lib/radar/types";
import {
  RADAR_RATE_LIMIT_PER_HOUR,
  countRecentSubmissions,
  findExactSourceMatch,
  loadRadarCandidates,
} from "@/lib/data/radar";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import type { KnownProductEvent } from "@/lib/telemetry/known-events";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT = 2000;

function field(form: FormData, name: string, max: number): string | null {
  const v = form.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) return json({ error: "Servizio non disponibile." }, 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Accedi per aggiungere una scoperta." }, 401);

  const enabled = await resolveFeatureFlag({ flagName: "RADAR_ENABLED", userId: user.id });
  if (!enabled) return json({ error: "Funzione non ancora disponibile per il tuo account." }, 403);

  if ((await countRecentSubmissions(supabase, user.id)) >= RADAR_RATE_LIMIT_PER_HOUR) {
    return json({ error: "Hai inviato molti contenuti nell'ultima ora. Riprova tra poco." }, 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }

  const urlInput = field(form, "url", 1000);
  const text = field(form, "text", MAX_TEXT);
  const note = field(form, "note", 500);
  const foundNear = field(form, "foundNear", 200);
  const userConfirmedRelevant = form.get("confirmedRelevant") === "1";
  const previousSubmissionId = field(form, "previousSubmissionId", 64);
  const requestedType = field(form, "sourceType", 32);
  const imageEntry = form.get("image");

  // ── Immagine: verificata e tenuta solo in memoria ───────────────
  let image: RadarInput["image"] = null;
  let imageSha256: string | null = null;
  if (imageEntry && typeof imageEntry !== "string") {
    const bytes = new Uint8Array(await imageEntry.arrayBuffer());
    const check = checkImage(bytes);
    if (!check.ok) return json({ error: check.error }, 400);
    imageSha256 = createHash("sha256").update(bytes).digest("hex");
    image = { base64: Buffer.from(bytes).toString("base64"), mimeType: check.mime };
  }

  // ── Link: normalizzato e letto solo nei metadati pubblici ───────
  let urlNormalized: string | null = null;
  let urlMetadata: UrlMetadata | null = null;
  if (urlInput) {
    urlNormalized = normalizeUrl(urlInput);
    if (!urlNormalized) return json({ error: "Il link non sembra valido. Controlla e riprova." }, 400);
    urlMetadata = await fetchUrlMetadata(urlNormalized);
  }

  if (!image && !urlNormalized && !text && !note) {
    return json({ error: "Aggiungi una foto, un link o un testo." }, 400);
  }

  const sourceType: RadarSourceType =
    requestedType && (RADAR_SOURCE_TYPES as readonly string[]).includes(requestedType)
      ? (requestedType as RadarSourceType)
      : image
        ? "flyer_photo"
        : urlNormalized
          ? "pasted_url"
          : "pasted_text";

  const input: RadarInput = {
    sourceType,
    image,
    text: [text, note].filter(Boolean).join("\n") || null,
    urlMetadata,
    userConfirmedRelevant,
    referenceDate: new Date().toISOString().slice(0, 10),
  };

  const provider = getRadarProvider();
  let candidatesCache: Awaited<ReturnType<typeof loadRadarCandidates>> | null = null;
  const loadCandidates = async () => (candidatesCache ??= await loadRadarCandidates(supabase));

  const analysis = await analyzeDiscoveryImport(input, {
    provider,
    loadCandidates,
    findExactSource: async () => findExactSourceMatch(supabase, imageSha256, urlNormalized, await loadCandidates()),
  });

  const outcome = analysis.relevance === "not_relevant" ? "rejected" : "pending";
  const { data: inserted, error: insertError } = await supabase
    .from("discovery_submissions")
    .insert({
      submitted_by: user.id,
      source_type: sourceType,
      source_url: urlNormalized,
      url_normalized: urlNormalized,
      image_sha256: imageSha256,
      user_note: note,
      found_near: foundNear,
      relevance_status: analysis.relevance,
      relevance_confidence: analysis.relevanceConfidence,
      extraction_confidence: analysis.extractionConfidence,
      warnings: analysis.warnings,
      extracted: analysis.extracted,
      analyzer: analysis.analyzer,
      outcome,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[radar] salvataggio invio fallito:", insertError?.message);
    return json({ error: "Non siamo riusciti a registrare il contenuto. Riprova." }, 500);
  }

  // Un nuovo tentativo sullo stesso contenuto (nota aggiunta, conferma)
  // chiude il precedente rimasto in sospeso.
  if (previousSubmissionId) {
    await supabase
      .from("discovery_submissions")
      .update({ outcome: "abandoned", updated_at: new Date().toISOString() })
      .eq("id", previousSubmissionId)
      .eq("submitted_by", user.id)
      .eq("outcome", "pending");
  }

  const events: KnownProductEvent[] = [image ? "radar_image_submitted" : urlNormalized ? "radar_url_submitted" : "radar_text_submitted"];
  events.push(
    analysis.relevance === "relevant"
      ? "radar_relevant_detected"
      : analysis.relevance === "not_relevant"
        ? "radar_irrelevant_rejected"
        : "radar_uncertain_detected"
  );
  if (analysis.nextStep === "open_existing") events.push("radar_duplicate_detected");
  for (const event of events) {
    await persistProductEvent(
      { event, correlationId: generateCorrelationId(), tenant: "family", detail: analysis.analyzer },
      { supabase, userId: user.id }
    );
  }

  return json({ submissionId: (inserted as { id: string }).id, analysis });
}
