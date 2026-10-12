// TRAMA — RADAR (12/10/2026). Conversione dei dati TRAMA esistenti nella
// forma comune MatchCandidate (lib/radar/match.ts). Modulo PURO: le righe
// arrivano già lette (lib/data/radar.ts); il dataset Curated è nel codice.

import type { MatchCandidate } from "@/lib/radar/match";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";

/** Riga Partner: attività con il suo centro (colonne lette in lib/data/radar.ts). */
export interface PartnerActivityRow {
  id: string;
  name: string;
  city: string | null;
  centers: {
    name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    social_links: unknown;
  } | null;
}

export interface CommunityDiscoveryRow {
  id: string;
  title: string;
  organizer_name: string | null;
  comune: string | null;
  start_date: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  social_url: string | null;
  dedupe_key: string;
}

function socialUrls(links: unknown): string[] {
  if (!links || typeof links !== "object") return [];
  return Object.values(links as Record<string, unknown>).filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
}

export function partnerActivityToCandidate(row: PartnerActivityRow): MatchCandidate {
  return {
    kind: "activity",
    id: row.id,
    title: row.name,
    organizerName: row.centers?.name ?? null,
    comune: row.city,
    urls: socialUrls(row.centers?.social_links),
    emails: row.centers?.contact_email ? [row.centers.contact_email.toLowerCase()] : [],
    phones: row.centers?.contact_phone ? [row.centers.contact_phone] : [],
  };
}

export function curatedLeadToCandidate(lead: DiscoveryLeadRecord): MatchCandidate {
  const urls = [lead.officialUrl, lead.registrationUrl, ...lead.sources.map((s) => s.url)].filter((u): u is string => !!u);
  const contact = lead.contact ?? "";
  return {
    kind: "curated",
    id: lead.id,
    title: lead.activityTitle,
    organizerName: lead.organizerName,
    comune: lead.comune,
    urls,
    emails: contact.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)?.map((e) => e.toLowerCase()) ?? [],
    phones: contact.match(/(?:\+39\s?)?(?:3\d{2}|0\d{1,3})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) ?? [],
    startDate: lead.startDate,
  };
}

export function communityDiscoveryToCandidate(row: CommunityDiscoveryRow): MatchCandidate {
  return {
    kind: "community",
    id: row.id,
    title: row.title,
    organizerName: row.organizer_name,
    comune: row.comune,
    urls: [row.website_url, row.social_url].filter((u): u is string => !!u),
    emails: row.contact_email ? [row.contact_email.toLowerCase()] : [],
    phones: row.contact_phone ? [row.contact_phone] : [],
    dedupeKey: row.dedupe_key,
    startDate: row.start_date,
  };
}
