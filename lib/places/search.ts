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
