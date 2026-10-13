// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: esperienza.
//
// Modulo PURO (nessun I/O, usabile da server e client) per mostrare le
// Community Discovery in Scopri, nella scheda e nei Preferiti:
// - il tipo del record (letto da lib/data/radar.ts);
// - le etichette (categoria, età, date, prezzo) che non inventano nulla:
//   un campo assente semplicemente non compare;
// - i filtri di Scopri applicati con la stessa regola delle Scoperte TRAMA
//   (un dato sconosciuto non esclude, salvo filtro Copertura esplicito);
// - l'id dei preferiti: "community:<uuid>" in curated_favorites (colonna
//   testuale senza FK, nessuna migration).

import {
  DISCOVERY_CATEGORY_TAG_MAP,
  isDiscoveryLeadCompatibleWithAgeRange,
  isDiscoveryLeadCompatibleWithPriceCap,
  isDiscoveryLeadCompatibleWithWeek,
} from "@/lib/discovery/real-dataset";

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

/** Badge unico, sempre presente su card e scheda (decisione D3). */
export const COMMUNITY_BADGE_LABEL = "Segnalato dalla community";

const FAVORITE_PREFIX = "community:";

export function communityFavoriteId(id: string): string {
  return `${FAVORITE_PREFIX}${id}`;
}

/** uuid della Community Discovery se l'id preferito è "community:<uuid>", altrimenti null. */
export function parseCommunityFavoriteId(favoriteId: string): string | null {
  if (!favoriteId.startsWith(FAVORITE_PREFIX)) return null;
  const id = favoriteId.slice(FAVORITE_PREFIX.length);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export function communityDetailHref(id: string, fromRadar = false): string {
  return `/nextgen/scoperta/${id}${fromRadar ? "?from=radar" : ""}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  educativo: "Educativo",
  sportivo: "Sportivo",
  multisport: "Multisport",
  artistico: "Artistico",
  evento: "Evento",
  altro: "Attività",
};

const CATEGORY_EMOJI: Record<string, string> = {
  educativo: "🎨",
  sportivo: "⚽",
  multisport: "🏅",
  artistico: "🎭",
  evento: "🎪",
  altro: "✨",
};

export function communityCategoryLabel(category: string | null): string {
  return (category && CATEGORY_LABELS[category]) || "Attività";
}

export function communityCategoryEmoji(category: string | null): string {
  return (category && CATEGORY_EMOJI[category]) || "✨";
}

export function formatCommunityAge(ageMin: number | null, ageMax: number | null): string | null {
  if (ageMin != null && ageMax != null) return ageMin === ageMax ? `${ageMin} anni` : `${ageMin}-${ageMax} anni`;
  if (ageMax != null) return `fino a ${ageMax} anni`;
  if (ageMin != null) return `da ${ageMin} anni`;
  return null;
}

function formatIsoDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** Date certe se note; altrimenti il testo originale (anno non indicato dalla fonte). */
export function formatCommunityDates(
  d: Pick<CommunityDiscoveryRecord, "startDate" | "endDate" | "dateTextRaw">
): string | null {
  if (d.startDate && d.endDate && d.startDate !== d.endDate) return `${formatIsoDay(d.startDate)} – ${formatIsoDay(d.endDate)}`;
  if (d.startDate) return formatIsoDay(d.startDate);
  if (d.dateTextRaw) return d.dateTextRaw;
  return null;
}

const PRICE_UNIT_LABELS: Record<string, string> = {
  per_settimana: "/ settimana",
  per_giorno: "/ giorno",
  per_mese: "/ mese",
  per_lezione: "/ lezione",
  totale: "totale",
};

export function formatCommunityPrice(price: number | null, priceUnit: string | null): string | null {
  if (price == null) return null;
  const amount = Number.isInteger(price) ? `€${price}` : `€${price.toFixed(2).replace(".", ",")}`;
  const unit = priceUnit ? PRICE_UNIT_LABELS[priceUnit] : null;
  return unit ? `${amount} ${unit}` : amount;
}

export function formatCommunityPlace(d: Pick<CommunityDiscoveryRecord, "locationName" | "comune">): string | null {
  if (d.locationName && d.comune) return `${d.locationName}, ${d.comune}`;
  return d.locationName ?? d.comune ?? null;
}

/** Link esterno principale: sito, altrimenti social. Solo http(s). */
export function communityExternalUrl(d: Pick<CommunityDiscoveryRecord, "websiteUrl" | "socialUrl">): string | null {
  for (const u of [d.websiteUrl, d.socialUrl]) {
    if (u && /^https?:\/\//i.test(u)) return u;
  }
  return null;
}

export interface CommunityFilterState {
  minAge: number;
  maxAge: number;
  maxPrice: number;
  zone: string;
  query: string;
  selectedTagIds: string[];
  selectedWeekRanges: { start: string; end: string }[];
  coverageFilterActive: boolean;
}

/**
 * Stessa semantica dei filtri delle Scoperte TRAMA: un dato che la fonte
 * non indica non esclude la scoperta (mai "0 risultati" per un campo
 * mancante). Unica eccezione, come per le Scoperte TRAMA: con un filtro
 * Copertura esplicito la modalità di frequenza non è nota → esclusa.
 */
export function isCommunityDiscoveryCompatible(d: CommunityDiscoveryRecord, f: CommunityFilterState): boolean {
  if (f.coverageFilterActive) return false;
  if (
    f.selectedWeekRanges.length > 0 &&
    !f.selectedWeekRanges.some((r) => isDiscoveryLeadCompatibleWithWeek(d, r.start, r.end))
  ) {
    return false;
  }
  if (!isDiscoveryLeadCompatibleWithAgeRange(d, f.minAge, f.maxAge)) return false;
  if (!isDiscoveryLeadCompatibleWithPriceCap({ price: d.price, priceUnit: d.priceUnit === "per_settimana" ? "per_settimana" : null }, f.maxPrice)) {
    return false;
  }
  const zone = f.zone.trim().toLowerCase();
  if (zone) {
    const haystack = `${d.locationName ?? ""} ${d.address ?? ""} ${d.comune ?? ""}`.toLowerCase();
    if (!haystack.includes(zone)) return false;
  }
  const q = f.query.trim().toLowerCase();
  if (q) {
    const haystack = `${d.title} ${d.organizerName ?? ""} ${d.shortDescription ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (f.selectedTagIds.length > 0 && d.category && d.category in DISCOVERY_CATEGORY_TAG_MAP) {
    const tags = DISCOVERY_CATEGORY_TAG_MAP[d.category as keyof typeof DISCOVERY_CATEGORY_TAG_MAP];
    if (!tags.some((t) => f.selectedTagIds.includes(t))) return false;
  }
  return true;
}

export function filterCommunityDiscoveries(list: CommunityDiscoveryRecord[], f: CommunityFilterState): CommunityDiscoveryRecord[] {
  return list.filter((d) => isCommunityDiscoveryCompatible(d, f));
}
