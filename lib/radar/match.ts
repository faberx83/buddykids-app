// TRAMA — RADAR (12/10/2026). Deduplica e matching con quello che TRAMA
// conosce già (brief §7-8). Funzioni PURE: i candidati arrivano già letti
// dal database (lib/data/radar.ts) o dal dataset Curated nel codice.
//
// Ordine dei casi:
//  A) attività già presente (Partner, Scoperta TRAMA o Community) → si apre
//     quella, nessun duplicato, si registra solo il segnale di interesse;
//  B/C) provider presente o probabilmente presente → si propone, mai merge
//     automatico senza evidenza forte;
//  D) nulla di simile → nuova Community Discovery.
// "Evidenza forte" = stesso sito/URL, stessa email, stesso telefono, oppure
// stessa chiave di deduplica (titolo + organizzatore + comune + anno).

import type { CandidateKind, CandidateMatch, RadarExtractedData } from "@/lib/radar/types";
import { normalizeUrl } from "@/lib/radar/url";

const STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "un", "una", "di", "da", "del", "della", "dei", "delle", "e", "ed", "a", "al",
  "alla", "in", "per", "con", "su", "the", "and", "asd", "ssd", "aps", "onlus", "srl", "sas",
]);

export function normalizeForMatch(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

function tokens(text: string | null | undefined): Set<string> {
  return new Set(normalizeForMatch(text).split(" ").filter((t) => t.length > 1));
}

/** Somiglianza di Jaccard tra insiemi di parole (0..1). */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0039/, "").replace(/^39(?=3\d{8,9}$)/, "");
  return digits.length >= 6 ? digits : null;
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return new URL(normalized).hostname;
}

/**
 * Chiave di deduplica della Community Discovery: titolo e organizzatore
 * normalizzati, comune, anno (se noto). Due volantini dello stesso campus
 * fotografati da genitori diversi producono la stessa chiave.
 */
export function buildDedupeKey(data: Pick<RadarExtractedData, "title" | "organizerName" | "comune" | "startDate">): string {
  const year = data.startDate ? data.startDate.slice(0, 4) : "na";
  return [normalizeForMatch(data.title), normalizeForMatch(data.organizerName), normalizeForMatch(data.comune), year].join("|");
}

/** Forma comune dei candidati, qualunque sia la loro origine. */
export interface MatchCandidate {
  kind: CandidateKind;
  id: string;
  title: string;
  organizerName: string | null;
  comune: string | null;
  urls: string[];
  emails: string[];
  phones: string[];
  dedupeKey?: string | null;
  startDate?: string | null;
}

const SOCIAL_OR_PORTAL = /(^|\.)(instagram|facebook|tiktok|youtube|comune\.[a-z]+|google|linktr)\./;

function sharedDomain(a: string[], b: string[]): string | null {
  const da = new Set(a.map(domainOf).filter((d): d is string => !!d && !SOCIAL_OR_PORTAL.test(`.${d}`)));
  for (const d of b.map(domainOf)) if (d && da.has(d)) return d;
  return null;
}

function sharedNormalizedUrl(a: string[], b: string[]): boolean {
  const na = new Set(a.map(normalizeUrl).filter(Boolean));
  return b.map(normalizeUrl).some((u) => u && na.has(u));
}

export function scoreCandidate(data: RadarExtractedData, candidate: MatchCandidate): CandidateMatch | null {
  const reasons: string[] = [];
  let strong = false;
  let score = 0;

  const myUrls = [data.websiteUrl, data.socialUrl].filter((u): u is string => !!u);
  if (myUrls.length && sharedNormalizedUrl(myUrls, candidate.urls)) {
    reasons.push("stesso link");
    strong = true;
    score = Math.max(score, 0.95);
  } else {
    const d = sharedDomain(myUrls, candidate.urls);
    if (d) {
      reasons.push(`stesso sito (${d})`);
      score = Math.max(score, 0.7);
    }
  }

  if (data.contactEmail && candidate.emails.some((e) => e.toLowerCase() === data.contactEmail)) {
    reasons.push("stessa email");
    score = Math.max(score, 0.85);
  }
  const myPhone = normalizePhone(data.contactPhone);
  if (myPhone && candidate.phones.some((p) => normalizePhone(p) === myPhone)) {
    reasons.push("stesso telefono");
    score = Math.max(score, 0.85);
  }

  const key = buildDedupeKey(data);
  if (candidate.dedupeKey && candidate.dedupeKey === key && normalizeForMatch(data.title)) {
    reasons.push("stessi titolo, organizzatore e luogo");
    strong = true;
    score = Math.max(score, 0.95);
  }

  const titleSim = textSimilarity(data.title, candidate.title);
  const orgSim = textSimilarity(data.organizerName, candidate.organizerName);
  const sameComune = !!data.comune && !!candidate.comune && normalizeForMatch(data.comune) === normalizeForMatch(candidate.comune);
  const nameScore = Math.max(titleSim, orgSim, textSimilarity(data.organizerName, candidate.title), textSimilarity(data.title, candidate.organizerName));
  if (nameScore >= 0.5) {
    reasons.push(sameComune ? "nome simile nello stesso comune" : "nome simile");
    score = Math.max(score, sameComune ? 0.55 + nameScore * 0.35 : 0.35 + nameScore * 0.3);
  }

  // Contatto in comune + nome simile: è la stessa realtà.
  if ((reasons.includes("stessa email") || reasons.includes("stesso telefono")) && nameScore >= 0.3) {
    strong = true;
    score = Math.max(score, 0.92);
  }
  // Titolo quasi identico, stesso comune e stesso anno: stessa attività.
  if (titleSim >= 0.85 && sameComune && (!data.startDate || !candidate.startDate || data.startDate.slice(0, 4) === candidate.startDate.slice(0, 4))) {
    strong = true;
    score = Math.max(score, 0.9);
  }

  if (score < 0.45) return null;
  return {
    kind: candidate.kind,
    id: candidate.id,
    title: candidate.title,
    organizerName: candidate.organizerName,
    comune: candidate.comune,
    score: Math.round(score * 100) / 100,
    reasons,
    strong,
  };
}

/** I migliori 3 candidati, il più forte per primo. */
export function findCandidateMatches(data: RadarExtractedData, candidates: MatchCandidate[]): CandidateMatch[] {
  if (!data.title && !data.organizerName && !data.websiteUrl && !data.socialUrl && !data.contactEmail && !data.contactPhone) {
    return [];
  }
  return candidates
    .map((c) => scoreCandidate(data, c))
    .filter((m): m is CandidateMatch => m !== null)
    .sort((a, b) => Number(b.strong) - Number(a.strong) || b.score - a.score)
    .slice(0, 3);
}
