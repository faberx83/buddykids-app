import "server-only";

// TRAMA — RADAR (12/10/2026). Accesso ai dati del motore Radar
// (migration_42): candidati per il matching, doppioni esatti, rate limit e
// lettura delle Community Discovery. Tutte le query passano dal client con
// la sessione dell'utente: le RLS fanno da ultima barriera (un utente vede
// solo i propri invii e segnali; le scoperte "visible" sono di tutti).

import type { createClient } from "@/lib/supabase/server";
import { REAL_DISCOVERY_LEADS } from "@/lib/discovery/real-dataset";
import {
  communityDiscoveryToCandidate,
  curatedLeadToCandidate,
  partnerActivityToCandidate,
  type CommunityDiscoveryRow,
  type PartnerActivityRow,
} from "@/lib/radar/candidates";
import type { MatchCandidate } from "@/lib/radar/match";
import type { CandidateMatch } from "@/lib/radar/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const RADAR_RATE_LIMIT_PER_HOUR = 20;

export const COMMUNITY_COLUMNS =
  "id, title, organizer_name, category, short_description, age_min, age_max, start_date, end_date, date_text_raw, schedule_text, location_name, address, comune, price, price_unit, contact_phone, contact_email, website_url, social_url, registration_info, field_provenance, dedupe_key, status, created_at";

export async function loadRadarCandidates(supabase: Supabase): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = REAL_DISCOVERY_LEADS.map(curatedLeadToCandidate);

  const { data: activities, error: actError } = await supabase
    .from("activities")
    .select("id, name, city, centers ( name, contact_email, contact_phone, social_links )")
    .limit(500);
  if (actError) console.error("[radar] lettura attività Partner fallita:", actError.message);
  for (const row of (activities ?? []) as unknown as PartnerActivityRow[]) {
    const center = Array.isArray(row.centers) ? (row.centers[0] ?? null) : row.centers;
    candidates.push(partnerActivityToCandidate({ ...row, centers: center }));
  }

  const { data: community, error: comError } = await supabase
    .from("community_discoveries")
    .select("id, title, organizer_name, comune, start_date, contact_email, contact_phone, website_url, social_url, dedupe_key")
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (comError) console.error("[radar] lettura community discoveries fallita:", comError.message);
  for (const row of (community ?? []) as unknown as CommunityDiscoveryRow[]) {
    candidates.push(communityDiscoveryToCandidate(row));
  }
  return candidates;
}

/**
 * Doppione esatto: stessa immagine (impronta) o stesso link già collegati a
 * un contenuto, anche se li ha inviati un altro genitore. Passa dalla
 * funzione SECURITY DEFINER radar_find_existing_source, che restituisce solo
 * il contenuto collegato, mai chi l'ha inviato.
 */
export async function findExactSourceMatch(
  supabase: Supabase,
  imageSha256: string | null,
  urlNormalized: string | null,
  candidates: MatchCandidate[]
): Promise<CandidateMatch | null> {
  if (!imageSha256 && !urlNormalized) return null;
  const { data, error } = await supabase.rpc("radar_find_existing_source", {
    p_image_sha256: imageSha256,
    p_url_normalized: urlNormalized,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as {
    community_discovery_id: string | null;
    activity_id: string | null;
    curated_lead_id: string | null;
  };
  const target = row.community_discovery_id
    ? candidates.find((c) => c.kind === "community" && c.id === row.community_discovery_id)
    : row.activity_id
      ? candidates.find((c) => c.kind === "activity" && c.id === row.activity_id)
      : row.curated_lead_id
        ? candidates.find((c) => c.kind === "curated" && c.id === row.curated_lead_id)
        : undefined;
  if (!target) return null; // es. scoperta nascosta dall'admin: si procede con l'analisi normale
  return {
    kind: target.kind,
    id: target.id,
    title: target.title,
    organizerName: target.organizerName,
    comune: target.comune,
    score: 1,
    reasons: [imageSha256 ? "stessa foto già inviata" : "stesso link già inviato"],
    strong: true,
  };
}

export async function countRecentSubmissions(supabase: Supabase, userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("discovery_submissions")
    .select("id", { count: "exact", head: true })
    .eq("submitted_by", userId)
    .gte("created_at", since);
  if (error) return 0;
  return count ?? 0;
}

export interface CommunityDiscoveryRecord {
  id: string;
  title: string;
  organizerName: string | null;
  category: string | null;
  shortDescription: string | null;
  ageMin: number | null;
  ageMax: number | null;
  startDate: string | null;
  endDate: string | null;
  dateTextRaw: string | null;
  scheduleText: string | null;
  locationName: string | null;
  address: string | null;
  comune: string | null;
  price: number | null;
  priceUnit: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  registrationInfo: string | null;
  fieldProvenance: Record<string, string>;
  createdAt: string;
}

interface CommunityRawRow {
  id: string;
  title: string;
  organizer_name: string | null;
  category: string | null;
  short_description: string | null;
  age_min: number | null;
  age_max: number | null;
  start_date: string | null;
  end_date: string | null;
  date_text_raw: string | null;
  schedule_text: string | null;
  location_name: string | null;
  address: string | null;
  comune: string | null;
  price: number | string | null;
  price_unit: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  social_url: string | null;
  registration_info: string | null;
  field_provenance: Record<string, string> | null;
  created_at: string;
}

export function mapCommunityRow(row: CommunityRawRow): CommunityDiscoveryRecord {
  return {
    id: row.id,
    title: row.title,
    organizerName: row.organizer_name,
    category: row.category,
    shortDescription: row.short_description,
    ageMin: row.age_min,
    ageMax: row.age_max,
    startDate: row.start_date,
    endDate: row.end_date,
    dateTextRaw: row.date_text_raw,
    scheduleText: row.schedule_text,
    locationName: row.location_name,
    address: row.address,
    comune: row.comune,
    price: row.price === null ? null : Number(row.price),
    priceUnit: row.price_unit,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    websiteUrl: row.website_url,
    socialUrl: row.social_url,
    registrationInfo: row.registration_info,
    fieldProvenance: row.field_provenance ?? {},
    createdAt: row.created_at,
  };
}

/** Community Discovery visibili, per Scopri (usata dalla patch 2). Tabella assente → lista vuota. */
export async function getVisibleCommunityDiscoveries(supabase: Supabase): Promise<CommunityDiscoveryRecord[]> {
  const { data, error } = await supabase
    .from("community_discoveries")
    .select(COMMUNITY_COLUMNS)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as unknown as CommunityRawRow[]).map(mapCommunityRow);
}

export async function getCommunityDiscoveryById(supabase: Supabase, id: string): Promise<CommunityDiscoveryRecord | null> {
  const { data, error } = await supabase.from("community_discoveries").select(COMMUNITY_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapCommunityRow(data as unknown as CommunityRawRow);
}
