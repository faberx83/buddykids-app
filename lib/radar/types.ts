// TRAMA — RADAR / COMMUNITY DISCOVERY (12/10/2026), patch 1: motore.
//
// Tipi condivisi del motore Radar. Modulo PURO: nessun I/O, nessuna
// dipendenza da Supabase o Next, così è testabile senza browser e
// riutilizzabile lato server e lato client (solo i tipi).
//
// Pipeline (brief §19): INPUT → ANALISI → VALIDAZIONE → MATCHING →
// REVISIONE UTENTE → SALVATAGGIO. Il modello AI produce solo una proposta
// (RawAnalysis); quello che conta è l'esito validato (RadarAnalysis).

export const RADAR_SOURCE_TYPES = [
  "flyer_photo",
  "screenshot",
  "shared_url",
  "pasted_url",
  "pasted_text",
  "shared_image",
  "manual",
  "future_other",
] as const;
export type RadarSourceType = (typeof RADAR_SOURCE_TYPES)[number];

export type RelevanceStatus = "relevant" | "not_relevant" | "uncertain";
export type ConfidenceLevel = "high" | "medium" | "low";

export const COMMUNITY_CATEGORIES = ["educativo", "sportivo", "multisport", "artistico", "evento", "altro"] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const PRICE_UNITS = ["per_settimana", "per_giorno", "totale", "per_mese", "per_lezione"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

/** Provenienza di un campo (brief §4). */
export type FieldProvenance = "extracted" | "user_confirmed" | "existing_trama_data";

/**
 * Dati di un'attività come li vede Radar. Ogni campo assente resta `null`:
 * mai stimato, mai "completato" (brief §3: "MAI inventare informazioni").
 */
export interface RadarExtractedData {
  title: string | null;
  organizerName: string | null;
  category: CommunityCategory | null;
  shortDescription: string | null;
  ageMin: number | null;
  ageMax: number | null;
  startDate: string | null; // YYYY-MM-DD, solo se l'anno è certo
  endDate: string | null; // YYYY-MM-DD, solo se l'anno è certo
  dateTextRaw: string | null; // testo originale quando l'anno non è certo
  scheduleText: string | null;
  locationName: string | null;
  address: string | null;
  comune: string | null;
  price: number | null;
  priceUnit: PriceUnit | null;
  contactPhone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  registrationInfo: string | null;
}

export const EXTRACTED_FIELDS: readonly (keyof RadarExtractedData)[] = [
  "title",
  "organizerName",
  "category",
  "shortDescription",
  "ageMin",
  "ageMax",
  "startDate",
  "endDate",
  "dateTextRaw",
  "scheduleText",
  "locationName",
  "address",
  "comune",
  "price",
  "priceUnit",
  "contactPhone",
  "contactEmail",
  "websiteUrl",
  "socialUrl",
  "registrationInfo",
];

export function emptyExtractedData(): RadarExtractedData {
  return {
    title: null,
    organizerName: null,
    category: null,
    shortDescription: null,
    ageMin: null,
    ageMax: null,
    startDate: null,
    endDate: null,
    dateTextRaw: null,
    scheduleText: null,
    locationName: null,
    address: null,
    comune: null,
    price: null,
    priceUnit: null,
    contactPhone: null,
    contactEmail: null,
    websiteUrl: null,
    socialUrl: null,
    registrationInfo: null,
  };
}

/** Quello che arriva al provider di analisi (immagine già letta in memoria). */
export interface RadarInput {
  sourceType: RadarSourceType;
  image?: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" } | null;
  /** Testo incollato dall'utente o nota aggiunta ("È un centro estivo per 6-11 anni…"). */
  text?: string | null;
  /** Metadati pubblici di una pagina web (titolo, descrizione OpenGraph): mai il contenuto completo. */
  urlMetadata?: UrlMetadata | null;
  /** L'utente ha dichiarato esplicitamente "È un'attività per bambini/famiglie". */
  userConfirmedRelevant?: boolean;
  /** Anno di riferimento per interpretare le date ("oggi"), passato dal server. */
  referenceDate: string; // YYYY-MM-DD
}

export interface UrlMetadata {
  url: string;
  normalizedUrl: string;
  host: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** true se l'host è un social che di solito non espone il contenuto del post. */
  isSocialHost: boolean;
  /** true se la pagina non era raggiungibile o non ha restituito metadati utili. */
  unreadable: boolean;
}

/**
 * Proposta del provider (modello AI o simulazione), prima della validazione.
 * Il server non si fida di nessun campo: passa tutto da validateRawAnalysis.
 */
export interface RawAnalysis {
  relevance: unknown;
  relevanceConfidence: unknown;
  extractionConfidence?: unknown;
  extracted?: unknown;
  warnings?: unknown;
  reason?: unknown;
}

export interface RadarProvider {
  readonly name: string;
  analyze(input: RadarInput): Promise<RawAnalysis>;
}

export type RadarWarning =
  | "date_year_ambiguous"
  | "price_missing"
  | "partial_content"
  | "social_content_unavailable"
  | "url_unreadable"
  | "image_unreadable_in_simulation"
  | "low_text"
  | "field_discarded_invalid"
  | "adult_only_activity"
  | "personal_data_ignored";

export type CandidateKind = "activity" | "curated" | "community";

export interface CandidateMatch {
  kind: CandidateKind;
  id: string;
  title: string;
  organizerName: string | null;
  comune: string | null;
  /** 0..1, solo per governare il flusso: mai mostrato come percentuale. */
  score: number;
  /** Elementi che hanno prodotto il match (es. "stesso sito", "stesso telefono"). */
  reasons: string[];
  /** true solo con evidenza forte: Radar può collegare senza chiedere. */
  strong: boolean;
}

export interface RadarAnalysis {
  relevance: RelevanceStatus;
  relevanceConfidence: ConfidenceLevel;
  extractionConfidence: ConfidenceLevel | null;
  extracted: RadarExtractedData;
  warnings: RadarWarning[];
  candidateMatches: CandidateMatch[];
  /** Passo successivo che la UI deve proporre. */
  nextStep: RadarNextStep;
  analyzer: string;
}

export type RadarNextStep =
  | "reject" // NOT_RELEVANT: nessun record, al massimo "Segnala comunque" come feedback
  | "ask_confirmation" // UNCERTAIN: nessun record pubblico prima della conferma
  | "open_existing" // match forte con qualcosa che esiste già
  | "choose_match" // possibili match da far confermare all'utente
  | "review_and_save"; // anteprima con i dati estratti → "Salva scoperta"
