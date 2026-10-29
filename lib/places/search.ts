// TRAMA — RICERCA LUOGHI (21/10/2026, release "ricerca-luoghi").
// Fabrizio: "sulle scuole possiamo mettere un campo che si autocompleta con
// l'indirizzo? se scrivo il nome della scuola deve riconoscerlo e mettere
// l'indirizzo. Stessa cosa per gli impegni personali".
//
// Fornitore: Photon (komoot, Germania) sui dati OpenStreetMap — gratuito,
// senza chiave, pensato per i suggerimenti mentre si scrive (Nominatim lo
// vieta). Lo chiama SOLO il nostro server (app/api/places/search): al
// servizio arriva il testo digitato, mai chi lo digita. Licenza dei dati:
// ODbL, quindi sotto i suggerimenti "© OpenStreetMap".
//
// Qui solo la parte pura: costruzione della richiesta e lettura della
// risposta (GeoJSON di Photon), usata dalla route e dai test.

export const PLACE_SEARCH_FLAG = "PLACE_SEARCH_ENABLED";

export interface PlaceSuggestion {
  /** Nome del luogo (scuola, palestra…) oppure la via se è un indirizzo. */
  name: string;
  /** "Via Rossi 1, 20100 Milano" (vuoto se non noto). */
  address: string;
  lat: number;
  lng: number;
  /** Tipo OSM, es. "amenity:school". */
  kind: string;
  /** 22/10/2026 (scuola unificata): Comune del luogo, se noto ("Milano"). Mai la provincia. */
  city?: string;
  /** 22/10/2026: regione come la dà OpenStreetMap ("Lombardia", "Trentino-Alto Adige/Südtirol"). */
  region?: string;
}

export const PHOTON_URL = "https://photon.komoot.io/api/";
/** Italia (lon min, lat min, lon max, lat max). */
export const ITALY_BBOX = "6.6,35.4,18.6,47.1";
export const MIN_QUERY_LENGTH = 3;

export function buildPhotonUrl(input: {
  q: string;
  kind?: "school" | "any";
  near?: { lat: number; lng: number } | null;
  limit?: number;
}): string | null {
  const q = input.q.replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < MIN_QUERY_LENGTH) return null;
  const params = new URLSearchParams({ q, limit: String(Math.min(Math.max(input.limit ?? 6, 1), 10)), bbox: ITALY_BBOX });
  if (input.near && Number.isFinite(input.near.lat) && Number.isFinite(input.near.lng)) {
    params.set("lat", input.near.lat.toFixed(4));
    params.set("lon", input.near.lng.toFixed(4));
  }
  if (input.kind === "school") {
    for (const tag of ["amenity:school", "amenity:kindergarten", "amenity:college"]) params.append("osm_tag", tag);
  }
  return `${PHOTON_URL}?${params.toString()}`;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parsePhotonResponse(json: unknown): PlaceSuggestion[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    if (str(p.countrycode) && str(p.countrycode).toUpperCase() !== "IT") continue;
    const street = [str(p.street), str(p.housenumber)].filter(Boolean).join(" ");
    const city = str(p.city) || str(p.town) || str(p.village) || str(p.county);
    const address = [street, [str(p.postcode), city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const name = str(p.name) || street || city;
    if (!name) continue;
    const key = `${name}|${address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      address,
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      kind: [str(p.osm_key), str(p.osm_value)].filter(Boolean).join(":"),
      ...((str(p.city) || str(p.town) || str(p.village)) ? { city: str(p.city) || str(p.town) || str(p.village) } : {}),
      ...(str(p.state) ? { region: str(p.state) } : {}),
    });
  }
  return out;
}

/** Testo da salvare nel campo "Dove": "Nome, indirizzo" senza ripetizioni. */
export function placeLocationText(p: Pick<PlaceSuggestion, "name" | "address">): string {
  if (!p.address) return p.name;
  if (p.address.toLowerCase().startsWith(p.name.toLowerCase())) return p.address;
  return `${p.name}, ${p.address}`;
}

// ─── 29/10/2026 — indirizzi del portale centri ───
// Fabrizio (profilo del centro): "se metto una via, non mi fa mettere civico,
// e mi riporta 20153 Milano". Per una VIA OpenStreetMap dà il nome della via
// in `name` e niente `street`: l'indirizzo costruito sopra resta solo
// "20153 Milano". Qui si ricompone "Via Padova 21": la via dal suggerimento
// e, se il suggerimento non ha il civico, quello scritto dal gestore.

/** "Via Padova" (o "Via Castellino da Castello 10") dal suggerimento. */
export function suggestionStreet(p: Pick<PlaceSuggestion, "name" | "address" | "kind">): string {
  const comma = p.address.indexOf(", ");
  if (comma > 0) return p.address.slice(0, comma);
  if (p.kind.startsWith("highway:")) return p.name;
  if (!p.address || /^\d{5}\b/.test(p.address)) return p.name;
  return p.address;
}

/** "20153 Milano" dal suggerimento (vuoto se non noto). */
export function suggestionLocality(p: Pick<PlaceSuggestion, "address" | "city">): string {
  const comma = p.address.indexOf(", ");
  if (comma > 0) return p.address.slice(comma + 2);
  if (/^\d{5}\b/.test(p.address) || (p.city && p.address === p.city)) return p.address;
  return p.city ?? "";
}

/** Ultimo numero civico scritto ("21", "21/a", "12B") che la via non contiene già. CAP (5 cifre) esclusi. */
export function typedHouseNumber(typed: string, street: string): string | null {
  const inStreet = new Set(street.toLowerCase().split(/[\s,]+/));
  const found = typed.match(/(?:^|[\s,])(\d{1,4}(?:\/?[a-zA-Z](?![a-zA-Z]))?(?:\/\d{1,3})?)(?=$|[\s,])/g) ?? [];
  const numbers = found.map((m) => m.replace(/^[\s,]+/, "")).filter((n) => !inStreet.has(n.toLowerCase()));
  return numbers.length > 0 ? numbers[numbers.length - 1] : null;
}

/** Campo "Via e numero": "Via Padova 21". */
export function streetAddressText(p: Pick<PlaceSuggestion, "name" | "address" | "kind">, typed: string): string {
  const street = suggestionStreet(p);
  const number = typedHouseNumber(typed, street);
  return number ? `${street} ${number}` : street;
}

/** Indirizzo completo in un campo solo: "Oratorio San Luigi, Via Roma 5, 20100 Milano" / "Via Padova 21, 20153 Milano". */
export function fullAddressText(p: Pick<PlaceSuggestion, "name" | "address" | "kind" | "city">, typed: string): string {
  const street = streetAddressText(p, typed);
  const place = !p.kind.startsWith("highway:") && !street.toLowerCase().startsWith(p.name.toLowerCase()) ? p.name : "";
  return [place, street, suggestionLocality(p)].filter(Boolean).join(", ");
}

// ─── 22/10/2026 — scuole che OpenStreetMap non registra come "scuola" ───
// Ritest di Fabrizio: "non trovo ancora Fondazione Grossman". Il ripiego
// del 21/10 cercava fra tutti i luoghi solo se fra le scuole non c'era
// NIENTE; ma Photon restituisce quasi sempre qualche scuola simile, quindi
// il ripiego non partiva. Ora: scuole e tutti i luoghi insieme, prima quelli
// il cui nome contiene le parole cercate; se non esce niente, si riprova
// senza le parole generiche ("Fondazione Grossman" → "Grossman").

const GENERIC_SCHOOL_WORDS = new Set([
  "scuola", "scuole", "istituto", "istituti", "ist", "fondazione", "primaria", "elementare", "elementari",
  "secondaria", "media", "medie", "infanzia", "materna", "nido", "asilo", "liceo", "comprensivo", "ic",
  "paritaria", "statale", "di", "del", "della", "dei", "delle", "e", "la", "il",
]);

function plain(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Le parole "che contano" della ricerca: senza scuola, istituto, fondazione, primaria… */
export function distinctiveWords(q: string): string[] {
  return plain(q)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC_SCHOOL_WORDS.has(w));
}

/** Testo da cercare di nuovo senza le parole generiche, o null se non cambia niente. */
export function retryQuery(q: string): string | null {
  const words = distinctiveWords(q);
  const retry = words.join(" ");
  return words.length > 0 && retry !== plain(q).trim() ? retry : null;
}

/**
 * Unisce i risultati fra le scuole e fra tutti i luoghi: prima chi ha nel
 * nome tutte le parole che contano, poi le scuole, poi il resto; niente
 * doppioni; al massimo `limit`.
 */
export function mergeSchoolSuggestions(q: string, schools: PlaceSuggestion[], any: PlaceSuggestion[], limit = 6): PlaceSuggestion[] {
  const words = distinctiveWords(q);
  const nameHas = (p: PlaceSuggestion) => words.length > 0 && words.every((w) => plain(p.name).includes(w));
  const seen = new Set<string>();
  const all: { p: PlaceSuggestion; rank: number; i: number }[] = [];
  [...schools, ...any].forEach((p, i) => {
    const key = `${p.name}|${p.address}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const isSchool = i < schools.length;
    all.push({ p, rank: nameHas(p) ? 0 : isSchool ? 1 : 2, i });
  });
  return all
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

// ─── 22/10/2026 — secondo test UX (UX-PARENT-018): risultati pertinenti ───
// "Scuola Demo UX Non Esistente" proponeva tabaccheria e trattoria;
// "Fondazione Grossman" un'azienda di Bolzano; "Pizzigoni" metteva Catania e
// Saronno prima di Milano. Con la ricerca "stretta" (solo il blocco Scuola
// del figlio, PARENT_UX_FIX_ENABLED):
//   - un luogo che non è una scuola resta solo se ha nel nome TUTTE le parole
//     che contano e, se la zona è nota, è nella stessa Regione o nel Comune;
//   - una scuola resta solo se ha nel nome almeno una parola che conta;
//   - prima chi è nel Comune o nella Regione della famiglia, poi il resto.
// Se non resta niente, il campo dice di usare il nome scritto (a mano).

export interface SchoolSearchZone {
  /** Comune della famiglia o già indicato per la scuola ("Milano"). */
  city?: string | null;
  /** Regione già indicata ("Lombardia"). */
  region?: string | null;
}

export function isSchoolKind(kind: string): boolean {
  return kind.startsWith("amenity:school") || kind.startsWith("amenity:kindergarten") || kind.startsWith("amenity:college");
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = plain(a).trim();
  const y = plain(b).trim();
  return x.length > 0 && y.length > 0 && (x === y || x.startsWith(y) || y.startsWith(x));
}

export function rankSchoolSuggestions(
  q: string,
  schools: PlaceSuggestion[],
  any: PlaceSuggestion[],
  zone: SchoolSearchZone = {},
  limit = 6
): PlaceSuggestion[] {
  const words = distinctiveWords(q);
  const nameAll = (p: PlaceSuggestion) => words.length > 0 && words.every((w) => plain(p.name).includes(w));
  const nameSome = (p: PlaceSuggestion) => words.length > 0 && words.some((w) => plain(p.name).includes(w));
  const inCity = (p: PlaceSuggestion) => sameText(p.city, zone.city);
  const inRegion = (p: PlaceSuggestion) => sameText(p.region, zone.region);
  const zoneKnown = Boolean(zone.region?.trim() || zone.city?.trim());
  const seen = new Set<string>();
  const kept: { p: PlaceSuggestion; key: number[]; i: number }[] = [];
  [...schools, ...any].forEach((p, i) => {
    const id = `${p.name}|${p.address}`.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    const school = i < schools.length || isSchoolKind(p.kind);
    if (school ? !nameSome(p) : !nameAll(p) || (zoneKnown && !inRegion(p) && !inCity(p))) return;
    const zoneRank = inCity(p) ? 0 : inRegion(p) ? 1 : 2;
    kept.push({ p, key: [zoneRank, nameAll(p) ? 0 : 1, school ? 0 : 1], i });
  });
  return kept
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}
