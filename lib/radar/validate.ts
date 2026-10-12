// TRAMA — RADAR (12/10/2026). Validazione lato server dell'analisi.
//
// Il provider (modello AI o simulazione) propone; questo modulo decide.
// Regole del brief applicate qui, in un unico punto testabile:
//  - relevance gate: un contenuto entra nel flusso di salvataggio solo se
//    RELEVANT con confidenza sufficiente; nel dubbio è UNCERTAIN (§2-3);
//  - mai inventare: campi non validi o non plausibili diventano null (§3-4);
//  - data senza anno certo: nessuna data ISO, resta solo il testo (§17);
//  - prezzo assente: null, mai stimato (§3, §17);
//  - attività solo per adulti: NOT_RELEVANT (§17).
// Modulo PURO, senza I/O.

import {
  COMMUNITY_CATEGORIES,
  PRICE_UNITS,
  emptyExtractedData,
  type CommunityCategory,
  type ConfidenceLevel,
  type PriceUnit,
  type RadarExtractedData,
  type RadarInput,
  type RadarWarning,
  type RawAnalysis,
  type RelevanceStatus,
} from "@/lib/radar/types";

const KNOWN_WARNINGS: readonly RadarWarning[] = [
  "date_year_ambiguous",
  "price_missing",
  "partial_content",
  "social_content_unavailable",
  "url_unreadable",
  "image_unreadable_in_simulation",
  "low_text",
  "field_discarded_invalid",
  "adult_only_activity",
  "personal_data_ignored",
];

export interface ValidatedAnalysis {
  relevance: RelevanceStatus;
  relevanceConfidence: ConfidenceLevel;
  extractionConfidence: ConfidenceLevel | null;
  extracted: RadarExtractedData;
  warnings: RadarWarning[];
}

function asConfidence(value: unknown, fallback: ConfidenceLevel): ConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function asRelevance(value: unknown): RelevanceStatus | null {
  return value === "relevant" || value === "not_relevant" || value === "uncertain" ? value : null;
}

// Rimuove caratteri di controllo e spazi superflui; tronca alla lunghezza
// massima accettata dal DB. Stringa vuota → null.
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

/** URL http(s) sintatticamente valido, senza credenziali; altrimenti null. */
export function cleanUrl(value: unknown): string | null {
  const text = cleanText(value, 500);
  if (!text) return null;
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function cleanEmail(value: unknown): string | null {
  const text = cleanText(value, 200);
  if (!text) return null;
  const email = text.toLowerCase();
  return /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/.test(email) ? email : null;
}

export function cleanPhone(value: unknown): string | null {
  const text = cleanText(value, 40);
  if (!text) return null;
  const digits = text.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+/, "");
  if (bare.length < 6 || bare.length > 15) return null;
  return text;
}

function cleanAge(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  return n >= 0 && n <= 18 ? n : null;
}

function cleanPrice(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < 0 || n > 10000) return null;
  return Math.round(n * 100) / 100;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Il testo contiene un anno esplicito (2026, 2027…) o una data con anno (22/06/27)? */
export function textHasExplicitYear(text: string | null): boolean {
  if (!text) return false;
  return /\b20\d{2}\b/.test(text) || /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(text);
}

function cleanIsoDate(value: unknown, referenceDate: string): string | null {
  if (typeof value !== "string" || !isIsoDate(value)) return null;
  const year = Number(value.slice(0, 4));
  const refYear = Number(referenceDate.slice(0, 4));
  // Plausibilità: niente attività di anni lontani (errore di lettura).
  return year >= refYear - 1 && year <= refYear + 2 ? value : null;
}

export function validateExtracted(
  raw: unknown,
  referenceDate: string,
  warnings: Set<RadarWarning>
): RadarExtractedData {
  const out = emptyExtractedData();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  out.title = cleanText(r.title, 160);
  out.organizerName = cleanText(r.organizerName, 160);
  out.category = (COMMUNITY_CATEGORIES as readonly string[]).includes(r.category as string)
    ? (r.category as CommunityCategory)
    : null;
  out.shortDescription = cleanText(r.shortDescription, 600);
  out.ageMin = cleanAge(r.ageMin);
  out.ageMax = cleanAge(r.ageMax);
  if (out.ageMin !== null && out.ageMax !== null && out.ageMin > out.ageMax) {
    out.ageMin = null;
    out.ageMax = null;
    warnings.add("field_discarded_invalid");
  }
  if ((r.ageMin != null && out.ageMin === null) || (r.ageMax != null && out.ageMax === null)) {
    warnings.add("field_discarded_invalid");
  }

  out.dateTextRaw = cleanText(r.dateTextRaw, 200);
  out.startDate = cleanIsoDate(r.startDate, referenceDate);
  out.endDate = cleanIsoDate(r.endDate, referenceDate);
  // §17 "Data senza anno": se il testo originale non contiene un anno, una
  // data ISO sarebbe un anno assunto dal modello → si scarta e resta il testo.
  if ((out.startDate || out.endDate) && out.dateTextRaw && !textHasExplicitYear(out.dateTextRaw)) {
    out.startDate = null;
    out.endDate = null;
    warnings.add("date_year_ambiguous");
  }
  if (out.startDate && out.endDate && out.startDate > out.endDate) {
    out.startDate = null;
    out.endDate = null;
    warnings.add("field_discarded_invalid");
  }
  if (!out.startDate && !out.endDate && out.dateTextRaw && !textHasExplicitYear(out.dateTextRaw)) {
    warnings.add("date_year_ambiguous");
  }

  out.scheduleText = cleanText(r.scheduleText, 300);
  out.locationName = cleanText(r.locationName, 200);
  out.address = cleanText(r.address, 300);
  out.comune = cleanText(r.comune, 120);
  out.price = cleanPrice(r.price);
  out.priceUnit =
    out.price !== null && (PRICE_UNITS as readonly string[]).includes(r.priceUnit as string)
      ? (r.priceUnit as PriceUnit)
      : null;
  out.contactPhone = cleanPhone(r.contactPhone);
  out.contactEmail = cleanEmail(r.contactEmail);
  out.websiteUrl = cleanUrl(r.websiteUrl);
  out.socialUrl = cleanUrl(r.socialUrl);
  out.registrationInfo = cleanText(r.registrationInfo, 300);
  return out;
}

/** Quanti dei campi che rendono utile una scoperta sono presenti. */
export function usefulFieldCount(data: RadarExtractedData): number {
  let n = 0;
  if (data.title) n++;
  if (data.organizerName) n++;
  if (data.ageMin !== null || data.ageMax !== null) n++;
  if (data.startDate || data.dateTextRaw) n++;
  if (data.comune || data.address || data.locationName) n++;
  if (data.contactPhone || data.contactEmail || data.websiteUrl || data.socialUrl) n++;
  return n;
}

export function validateRawAnalysis(raw: RawAnalysis, input: Pick<RadarInput, "referenceDate" | "userConfirmedRelevant">): ValidatedAnalysis {
  const warnings = new Set<RadarWarning>();
  if (Array.isArray(raw.warnings)) {
    for (const w of raw.warnings) {
      if ((KNOWN_WARNINGS as readonly string[]).includes(w as string)) warnings.add(w as RadarWarning);
    }
  }

  let relevance = asRelevance(raw.relevance) ?? "uncertain";
  let relevanceConfidence = asConfidence(raw.relevanceConfidence, "low");
  const extracted = validateExtracted(raw.extracted, input.referenceDate, warnings);

  // Attività solo per adulti: fuori perimetro TRAMA (§17).
  if (warnings.has("adult_only_activity")) {
    relevance = "not_relevant";
  }

  // Gate: "rilevante" con confidenza bassa non basta per creare nulla.
  if (relevance === "relevant" && relevanceConfidence === "low") {
    relevance = "uncertain";
  }
  // Un rifiuto poco convinto non deve buttare via un contenuto forse utile.
  if (relevance === "not_relevant" && relevanceConfidence === "low" && !warnings.has("adult_only_activity")) {
    relevance = "uncertain";
  }
  // Rilevante ma senza nemmeno un titolo o due dati utili: non si capisce
  // abbastanza per un'anteprima seria.
  if (relevance === "relevant" && (!extracted.title || usefulFieldCount(extracted) < 2)) {
    relevance = "uncertain";
    warnings.add("partial_content");
  }

  // Conferma esplicita dell'utente ("È un'attività per bambini/famiglie"):
  // sblocca solo il dubbio, mai un rifiuto netto.
  if (relevance === "uncertain" && input.userConfirmedRelevant) {
    relevance = "relevant";
    relevanceConfidence = "medium";
  }

  let extractionConfidence: ConfidenceLevel | null = null;
  if (relevance !== "not_relevant") {
    const proposed = asConfidence(raw.extractionConfidence, "low");
    const count = usefulFieldCount(extracted);
    const ceiling: ConfidenceLevel = count >= 5 ? "high" : count >= 3 ? "medium" : "low";
    const rank = { low: 0, medium: 1, high: 2 } as const;
    extractionConfidence = rank[proposed] <= rank[ceiling] ? proposed : ceiling;
    if (extracted.price === null) warnings.add("price_missing");
  }

  return {
    relevance,
    relevanceConfidence,
    extractionConfidence,
    // Un contenuto non pertinente non porta con sé nessun dato.
    extracted: relevance === "not_relevant" ? emptyExtractedData() : extracted,
    warnings: [...warnings],
  };
}
