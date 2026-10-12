// TRAMA — RADAR (12/10/2026). Provider di SIMULAZIONE (decisione di
// Fabrizio: "solo simulazione per ora").
//
// Deterministico e senza rete: legge solo il TESTO disponibile (testo
// incollato, nota dell'utente, titolo/descrizione pubblici di un link).
// Non sa leggere le immagini: una foto senza testo diventa UNCERTAIN con
// l'avviso "image_unreadable_in_simulation", così la UI chiede all'utente
// di aggiungere due righe ("Centro estivo 6-11 anni, giugno, Milano").
// Quando arriverà la chiave AI, lib/radar/providers/anthropic.ts prende il
// suo posto senza cambiare nient'altro del flusso.
//
// Le stesse funzioni di estrazione restano utili anche dopo: sono un
// ripiego onesto per il testo, mai un'invenzione.

import type { RadarInput, RadarProvider, RawAnalysis, RadarWarning } from "@/lib/radar/types";

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

// Contesto bambini/famiglie: senza almeno uno di questi, nessun contenuto è
// "rilevante" (un corso di yoga per adulti non è TRAMA).
const KID_CONTEXT = [
  /\bbambin[ie]\b/i, /\bbimb[ie]\b/i, /\bragazz[ie]\b/i, /\bfamigli[ae]\b/i, /\bfigli\b/i,
  /\bbaby\b/i, /\bkids?\b/i, /\bjunior\b/i, /\bscuola (dell'infanzia|primaria|elementare|media)\b/i,
  /\bper i più piccoli\b/i, /\bunder ?1\d\b/i, /\b(?:[3-9]|1[0-7])\s*(?:-|–|—|a|al|e)\s*(?:[4-9]|1[0-8])\s*anni\b/i,
  /\bdai?\s+\d{1,2}\s+(?:agli?|ai|a)\s+\d{1,2}\s+anni\b/i, /\bnati (?:nel|dal|tra)\b/i,
];

const ACTIVITY_WORDS = [
  /centr[oi] estiv[oi]/i, /\bcampus\b/i, /\bsummer camp\b/i, /\bcamp\b/i, /\bgrest\b/i, /\bc\.?r\.?e\.?\b/i,
  /oratorio estivo/i, /\blaboratori[oi]?\b/i, /\bcors[oi]\b/i, /\bdoposcuola\b/i, /\bludoteca\b/i,
  /\bsport\b/i, /\bcalcio\b/i, /\bnuoto\b/i, /\bdanza\b/i, /\bteatro\b/i, /\bmusica\b/i, /\bbasket\b/i,
  /\bpallavolo\b/i, /\btennis\b/i, /\bscherma\b/i, /\bginnastica\b/i, /\bscacchi\b/i, /\bcoding\b/i,
  /\binglese\b/i, /\bspettacolo\b/i, /\bfesta\b/i, /\bevento\b/i, /\battivit[àa]/i, /\biscrizion[ei]\b/i,
  /\bsettiman[ae]\b/i, /\bmerenda\b/i, /\bpranzo incluso\b/i, /\bpre[- ]?scuola\b/i, /\bpost[- ]?scuola\b/i,
  /\beducativ[oaie]\b/i, /\bscienz[ae]\b/i, /\barte\b/i, /\bopen day\b/i,
];

const NOT_RELEVANT_WORDS = [
  /\bamazon\b/i, /aggiungi al carrello/i, /\bcarrello\b/i, /\bspedizione\b/i, /consegna prevista/i, /\bordine n/i,
  /\biban\b/i, /\bsaldo disponibile\b/i, /\bbonifico\b/i, /estratto conto/i, /\bconto corrente\b/i,
  /\belezioni\b/i, /\bpartito\b/i, /\bvota\b/i, /\bricetta\b/i, /\bristorante\b/i, /\bpizzeria\b/i,
  /\bhappy hour\b/i, /\bdegustazione\b/i, /\bmeme\b/i, /\boffert[ae] lampo\b/i, /\bcoupon\b/i,
];

const ADULT_ONLY = [
  /\bsolo adulti\b/i, /\bper adulti\b/i, /\bover ?18\b/i, /\b18\+/i, /\bvietato ai minori\b/i, /\baperitivo\b/i,
];

const KNOWN_COMUNI = [
  "Milano", "Rho", "Pero", "Cornaredo", "Settimo Milanese", "Bareggio", "Cusago", "Monza", "Sesto San Giovanni",
  "Cinisello Balsamo", "Bollate", "Legnano", "Segrate", "San Donato Milanese", "Assago", "Corsico", "Buccinasco",
  "Bergamo", "Brescia", "Como", "Varese", "Lodi", "Pavia", "Bari", "Noicattaro", "Rutigliano", "Mola di Bari",
  "Triggiano", "Capurso", "Valenzano", "Casamassima", "Torino", "Roma", "Bologna", "Firenze", "Napoli",
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((n, p) => (p.test(text) ? n + 1 : n), 0);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface ExtractedDates {
  startDate: string | null;
  endDate: string | null;
  dateTextRaw: string | null;
}

/** Date in italiano: "dal 22 al 26 giugno 2027", "22-26 giugno", "22/06/2027", "dal 15 giugno al 4 settembre". */
export function extractItalianDates(text: string): ExtractedDates {
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

  // dal 15 giugno al 4 settembre [2027]
  const twoMonths = new RegExp(`(?:dal\\s+)?(\\d{1,2})\\s+(${monthNames})\\.?\\s+(?:al|-|–)\\s+(\\d{1,2})\\s+(${monthNames})\\.?(?:\\s+(20\\d{2}))?`, "i");
  // dal 22 al 26 giugno [2027] / 22-26 giugno [2027]
  const oneMonth = new RegExp(`(?:dal\\s+)?(\\d{1,2})\\s*(?:al|-|–|—)\\s*(\\d{1,2})\\s+(${monthNames})\\.?(?:\\s+(20\\d{2}))?`, "i");
  // 22/06/2027 - 26/06/2027 oppure 22/06 - 26/06
  const numeric = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\s*(?:al|-|–|—)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/i;
  // singola data: 22 giugno [2027]
  const single = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\.?(?:\\s+(20\\d{2}))?\\b`, "i");

  const toIso = (y: number, m: number, d: number): string | null => {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const date = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  };
  const fullYear = (y: string): number => (y.length === 2 ? 2000 + Number(y) : Number(y));

  let m = text.match(twoMonths);
  if (m) {
    const raw = m[0].trim();
    if (!m[5]) return { startDate: null, endDate: null, dateTextRaw: raw };
    const y = Number(m[5]);
    return { startDate: toIso(y, MONTHS[m[2].toLowerCase()], Number(m[1])), endDate: toIso(y, MONTHS[m[4].toLowerCase()], Number(m[3])), dateTextRaw: raw };
  }
  m = text.match(oneMonth);
  if (m) {
    const raw = m[0].trim();
    if (!m[4]) return { startDate: null, endDate: null, dateTextRaw: raw };
    const y = Number(m[4]);
    const month = MONTHS[m[3].toLowerCase()];
    return { startDate: toIso(y, month, Number(m[1])), endDate: toIso(y, month, Number(m[2])), dateTextRaw: raw };
  }
  m = text.match(numeric);
  if (m) {
    const raw = m[0].trim();
    const year = m[6] || m[3];
    if (!year) return { startDate: null, endDate: null, dateTextRaw: raw };
    const y = fullYear(year);
    return { startDate: toIso(m[3] ? fullYear(m[3]) : y, Number(m[2]), Number(m[1])), endDate: toIso(y, Number(m[5]), Number(m[4])), dateTextRaw: raw };
  }
  m = text.match(single);
  if (m) {
    const raw = m[0].trim();
    if (!m[3]) return { startDate: null, endDate: null, dateTextRaw: raw };
    const iso = toIso(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
    return { startDate: iso, endDate: iso, dateTextRaw: raw };
  }
  return { startDate: null, endDate: null, dateTextRaw: null };
}

export function extractAges(text: string): { ageMin: number | null; ageMax: number | null } {
  const range = text.match(/\b(\d{1,2})\s*(?:-|–|—|a|al|e)\s*(\d{1,2})\s*anni\b/i) || text.match(/\bdai?\s+(\d{1,2})\s+(?:agli?|ai|a)\s+(\d{1,2})\s+anni\b/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (a <= b && b <= 18) return { ageMin: a, ageMax: b };
  }
  return { ageMin: null, ageMax: null };
}

export function extractPrice(text: string): { price: number | null; priceUnit: RawPriceUnit } {
  const m = text.match(/€\s*(\d{1,4}(?:[.,]\d{1,2})?)/) || text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|euro\b)/i);
  if (!m) return { price: null, priceUnit: null };
  const price = Number(m[1].replace(",", "."));
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40).toLowerCase();
  let priceUnit: RawPriceUnit = null;
  if (/settiman|\/sett|a sett/.test(after)) priceUnit = "per_settimana";
  else if (/giorn|al dì|\/gg/.test(after)) priceUnit = "per_giorno";
  else if (/mes/.test(after)) priceUnit = "per_mese";
  else if (/lezion/.test(after)) priceUnit = "per_lezione";
  return { price: Number.isFinite(price) ? price : null, priceUnit };
}

type RawPriceUnit = "per_settimana" | "per_giorno" | "per_mese" | "per_lezione" | null;

function extractTitle(text: string): string | null {
  const lines = text.split(/\n|\s{2,}/).map((l) => l.trim()).filter(Boolean);
  const isNoise = (l: string) => /@|https?:\/\/|www\.|€|\b\d{3}[\s.-]?\d{3,}/.test(l) || l.length < 4 || l.length > 90;
  const withActivity = lines.find((l) => !isNoise(l) && ACTIVITY_WORDS.some((p) => p.test(l)));
  return withActivity ?? lines.find((l) => !isNoise(l)) ?? null;
}

function extractOrganizer(text: string): string | null {
  const m =
    text.match(/(?:organizzat[oa] da|a cura di|promoss[oa] da)\s+([^\n.,;]{3,80})/i) ||
    text.match(/\b((?:A\.?S\.?D\.?|ASD|SSD|Associazione|Polisportiva|Oratorio|Cooperativa|Parrocchia|Scuola)\s+[^\n.,;]{2,70})/);
  return m ? m[1].trim() : null;
}

function extractCategory(text: string): string | null {
  if (/multisport/i.test(text)) return "multisport";
  if (/\b(calcio|nuoto|basket|pallavolo|tennis|scherma|ginnastica|sport)\b/i.test(text)) return "sportivo";
  if (/\b(teatro|musica|danza|arte|pittura|laboratorio creativo)\b/i.test(text)) return "artistico";
  if (/\b(doposcuola|inglese|coding|scienz|educativ|robotica|centro estivo|centri estivi|campus)\b/i.test(text)) return "educativo";
  if (/\b(festa|spettacolo|evento|open day)\b/i.test(text)) return "evento";
  return null;
}

function extractComune(text: string): string | null {
  for (const c of KNOWN_COMUNI) {
    if (new RegExp(`\\b${c.replace(/ /g, "\\s+")}\\b`, "i").test(text)) return c;
  }
  return null;
}

/** Classificazione e estrazione dal solo testo, deterministica. */
export function analyzeTextDeterministic(text: string): RawAnalysis {
  const warnings: RadarWarning[] = [];
  const kid = countMatches(text, KID_CONTEXT);
  const activity = countMatches(text, ACTIVITY_WORDS);
  const negative = countMatches(text, NOT_RELEVANT_WORDS);
  const adult = countMatches(text, ADULT_ONLY);
  const words = text.split(/\s+/).filter(Boolean).length;

  if (words < 3) warnings.push("low_text");

  let relevance: "relevant" | "not_relevant" | "uncertain";
  let relevanceConfidence: "high" | "medium" | "low";
  if (adult > 0 && kid === 0) {
    relevance = "not_relevant";
    relevanceConfidence = "high";
    if (activity > 0) warnings.push("adult_only_activity");
  } else if (negative > 0 && kid === 0 && activity <= 1) {
    relevance = "not_relevant";
    relevanceConfidence = negative >= 2 ? "high" : "medium";
  } else if (kid > 0 && activity > 0) {
    relevance = "relevant";
    relevanceConfidence = kid + activity >= 4 ? "high" : "medium";
  } else if (kid > 0 || activity > 0) {
    relevance = "uncertain";
    relevanceConfidence = "medium";
  } else {
    relevance = words >= 6 ? "not_relevant" : "uncertain";
    relevanceConfidence = words >= 6 ? "medium" : "low";
  }

  if (relevance === "not_relevant") {
    return { relevance, relevanceConfidence, extracted: {}, warnings };
  }

  const dates = extractItalianDates(text);
  const ages = extractAges(text);
  const price = extractPrice(text);
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? null;
  const phone = text.match(/(?:\+39\s?)?(?:3\d{2}|0\d{1,3})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/)?.[0] ?? null;
  const urls = text.match(/(?:https?:\/\/|www\.)[^\s)>"']+/gi) ?? [];
  const social = urls.find((u) => /instagram|facebook|tiktok/i.test(u)) ?? null;
  const website = urls.find((u) => !/instagram|facebook|tiktok/i.test(u)) ?? null;

  const extracted = {
    title: extractTitle(text),
    organizerName: extractOrganizer(text),
    category: extractCategory(text),
    shortDescription: null,
    ageMin: ages.ageMin,
    ageMax: ages.ageMax,
    startDate: dates.startDate,
    endDate: dates.endDate,
    dateTextRaw: dates.dateTextRaw,
    scheduleText: text.match(/\b(?:dalle\s+)?\d{1,2}[:.]\d{2}\s*(?:-|–|alle)\s*\d{1,2}[:.]\d{2}\b/i)?.[0] ?? null,
    locationName: null,
    address: text.match(/\b(?:via|viale|piazza|corso|largo)\s+[A-Za-zÀ-ù' .]{2,40}\s*\d{0,4}\w?/i)?.[0]?.trim() ?? null,
    comune: extractComune(text),
    price: price.price,
    priceUnit: price.priceUnit,
    contactPhone: phone,
    contactEmail: email,
    websiteUrl: website,
    socialUrl: social,
    registrationInfo: null,
  };

  const filled = Object.values(extracted).filter((v) => v !== null).length;
  return {
    relevance,
    relevanceConfidence,
    extractionConfidence: filled >= 7 ? "high" : filled >= 4 ? "medium" : "low",
    extracted,
    warnings,
  };
}

export class MockRadarProvider implements RadarProvider {
  readonly name = "mock";

  async analyze(input: RadarInput): Promise<RawAnalysis> {
    const parts: string[] = [];
    if (input.text) parts.push(input.text);
    if (input.urlMetadata && !input.urlMetadata.unreadable) {
      if (input.urlMetadata.title) parts.push(input.urlMetadata.title);
      if (input.urlMetadata.description) parts.push(input.urlMetadata.description);
    }
    const text = parts.join("\n").trim();

    if (!text) {
      const warnings: RadarWarning[] = [];
      if (input.image) warnings.push("image_unreadable_in_simulation");
      if (input.urlMetadata?.isSocialHost) warnings.push("social_content_unavailable");
      if (input.urlMetadata?.unreadable) warnings.push("url_unreadable");
      return { relevance: "uncertain", relevanceConfidence: "low", extracted: {}, warnings };
    }

    const result = analyzeTextDeterministic(text);
    const warnings = Array.isArray(result.warnings) ? [...(result.warnings as RadarWarning[])] : [];
    if (input.urlMetadata?.isSocialHost && !input.text) warnings.push("social_content_unavailable");
    if (input.image && !input.text) warnings.push("image_unreadable_in_simulation");
    if (input.urlMetadata?.url && result.relevance !== "not_relevant") {
      const extracted = { ...(result.extracted as Record<string, unknown>) };
      if (input.urlMetadata.isSocialHost) extracted.socialUrl ??= input.urlMetadata.url;
      else extracted.websiteUrl ??= input.urlMetadata.url;
      return { ...result, extracted, warnings };
    }
    return { ...result, warnings };
  }
}
