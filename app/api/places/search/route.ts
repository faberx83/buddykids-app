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
import { PARTNER_SHELL_FLAG } from "@/lib/centers/partner-shell";
import { buildPhotonUrl, mergeSchoolSuggestions, parsePhotonResponse, PLACE_SEARCH_FLAG, rankSchoolSuggestions, retryQuery } from "@/lib/places/search";

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
  // 29/10/2026, portale centri V2 (Fabrizio: "qualsiasi funzionalità che abbiamo
  // aggiunto in portale genitori che ha senso - es. autocompilazione indirizzi -
  // va riportata anche qui"): i gestori (e l'Admin) col guscio nuovo acceso
  // cercano l'indirizzo del centro e delle attività. La release famiglie resta
  // com'era: per i genitori decide sempre e solo PLACE_SEARCH_ENABLED.
  if (!on && !(await partnerCanSearchPlaces(supabase, user.id))) return empty;

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const q = url.searchParams.get("q") ?? "";
  const kind = url.searchParams.get("kind") === "school" ? "school" : "any";
  const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  if (kind !== "school") return NextResponse.json({ suggestions: await searchPhoton(buildPhotonUrl({ q, kind, near })) });
  // 21–22/10/2026 — Fabrizio: "non mi trova la Fondazione Grossman". In
  // OpenStreetMap alcune scuole sono registrate come fondazione o ente, non
  // come "scuola": si cerca fra le scuole e fra tutti i luoghi insieme
  // (lib/places/search.ts#mergeSchoolSuggestions), e se non esce niente si
  // riprova senza le parole generiche ("Fondazione Grossman" → "Grossman").
  // Secondo test UX (22/10, UX-PARENT-018): con strict=1 (blocco Scuola del
  // figlio, PARENT_UX_FIX_ENABLED) niente luoghi estranei e prima la zona
  // della famiglia (lib/places/search.ts#rankSchoolSuggestions). Si chiedono
  // a Photon più risultati, perché poi se ne scartano.
  const strict = url.searchParams.get("strict") === "1";
  const zone = { city: url.searchParams.get("city"), region: url.searchParams.get("region") };
  const limit = strict ? 10 : undefined;
  const merge = (text: string, s: Awaited<ReturnType<typeof searchPhoton>>, a: Awaited<ReturnType<typeof searchPhoton>>) =>
    strict ? rankSchoolSuggestions(text, s, a, zone) : mergeSchoolSuggestions(text, s, a);
  const [schools, any] = await Promise.all([
    searchPhoton(buildPhotonUrl({ q, kind: "school", near, limit })),
    searchPhoton(buildPhotonUrl({ q, kind: "any", near, limit })),
  ]);
  let suggestions = merge(q, schools, any);
  const retry = suggestions.length === 0 ? retryQuery(q) : null;
  if (retry) {
    const [schools2, any2] = await Promise.all([
      searchPhoton(buildPhotonUrl({ q: retry, kind: "school", near, limit })),
      searchPhoton(buildPhotonUrl({ q: retry, kind: "any", near, limit })),
    ]);
    suggestions = merge(retry, schools2, any2);
  }
  return NextResponse.json({ suggestions });
}

async function searchPhoton(target: string | null) {
  if (!target) return [];
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "TRAMA (tramapp.it) - ricerca luoghi per famiglie", Accept: "application/json" },
      cache: "force-cache", // stessa ricerca = nessuna nuova chiamata a Photon
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    return parsePhotonResponse(await res.json());
  } catch {
    return [];
  }
}

async function partnerCanSearchPlaces(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const role = (profile?.role as string | undefined) ?? null;
    if (role !== "center_admin" && role !== "platform_admin") return false;
    return await resolveFeatureFlag({
      flagName: PARTNER_SHELL_FLAG,
      userId,
      role,
      tenant: "center",
      correlationId: generateCorrelationId(),
    });
  } catch {
    return false;
  }
}
