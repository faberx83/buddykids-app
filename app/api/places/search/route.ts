// TRAMA — RICERCA LUOGHI (21/10/2026, release "ricerca-luoghi").
// GET /api/places/search?q=…&kind=school|any → suggerimenti di luoghi in
// Italia (nome + indirizzo) da Photon/OpenStreetMap, vedi lib/places/search.ts.
// Solo per chi è collegato e ha la release accesa; al fornitore arriva solo
// il testo cercato. Risposte in cache (stessa ricerca = nessuna
// nuova chiamata). Errori → lista vuota: il campo resta testo libero.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { buildPhotonUrl, parsePhotonResponse, PLACE_SEARCH_FLAG } from "@/lib/places/search";

export async function GET(request: Request) {
  const empty = NextResponse.json({ suggestions: [] });
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ suggestions: [] }, { status: 401 });
  const on = await resolveFeatureFlag({
    flagName: PLACE_SEARCH_FLAG,
    userId: user.id,
    role: "parent",
    tenant: "family",
    correlationId: generateCorrelationId(),
  }).catch(() => false);
  if (!on) return empty;

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const target = buildPhotonUrl({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") === "school" ? "school" : "any",
    near: Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null,
  });
  if (!target) return empty;
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "TRAMA (tramapp.it) - ricerca luoghi per famiglie", Accept: "application/json" },
      cache: "force-cache", // stessa ricerca = nessuna nuova chiamata a Photon
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return empty;
    return NextResponse.json({ suggestions: parsePhotonResponse(await res.json()) });
  } catch {
    return empty;
  }
}
