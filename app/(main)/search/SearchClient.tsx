"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import ActivityCardHorizontal from "@/components/ActivityCardHorizontal";
import { Activity, Kid } from "@/lib/types";
import { categories } from "@/lib/mock-data";
import { haversineKm } from "@/lib/geo";
import { getSeasonWeekRanges, isoDate, formatShortRange } from "@/lib/season-weeks";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Leaflet usa `window`, quindi la mappa va caricata solo lato client.
const ActivityMap = dynamic(() => import("@/components/ActivityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-full items-center justify-center rounded-lg border border-[#E8EBF0] bg-bg text-sm text-ink-2">
      Carico la mappa…
    </div>
  ),
});

type FilterPanel = "eta" | "prezzo" | "zona" | "tag" | "servizi" | "data" | null;
type ViewMode = "lista" | "mappa";

interface ServiceFilters {
  preScuola: boolean;
  postScuola: boolean;
  pranzo: boolean;
  bar: boolean;
  attivitaExtra: boolean;
}

const EMPTY_SERVICES: ServiceFilters = {
  preScuola: false,
  postScuola: false,
  pranzo: false,
  bar: false,
  attivitaExtra: false,
};

const GEO_STORAGE_KEY = "bk_last_geo";
const DEFAULT_RADIUS_KM = 5;

function parseAgeRange(ageRange: string): [number, number] {
  const match = ageRange.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return [0, 99];
  return [Number(match[1]), Number(match[2])];
}

function readStoredGeo(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
  } catch {
    // ignoriamo — nessuna posizione disponibile
  }
  return null;
}

export default function SearchClient({
  initialActivities,
  seasonYear,
  kids,
  availabilityByWeek,
}: {
  initialActivities: Activity[];
  // Anno "di stagione" condiviso da tutta l'app (lib/data/season-year.ts) —
  // serve solo per mostrare la data giusta nel banner "Stai cercando per la
  // Settimana N": prima si usava sempre l'anno corrente, che con dati demo
  // di un anno diverso mostrava un intervallo di date sbagliato (anche se il
  // numero di settimana restava corretto).
  seasonYear: number;
  // Bambini del genitore loggato — servono a risolvere ?kid= in un bambino
  // reale e applicare il filtro "preferenze bambino" (kid.interests).
  kids: Kid[];
  // Per ciascuna delle 13 settimane stagionali (chiave: data ISO di inizio),
  // gli id (dbId) delle attività con ALMENO un activity_week con posti
  // liberi che si sovrappone a quella settimana — calcolato lato server
  // (lib/data/activities.ts#getActivityAvailabilityByWeek) perché richiede
  // di interrogare "activity_weeks", non disponibile nell'oggetto Activity
  // (che ha solo uno "spotsLeft" aggregato, non per-settimana).
  availabilityByWeek: Record<string, string[]>;
}) {
  const searchParams = useSearchParams();
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  // Impostato quando si arriva dal pulsante "Riempi" del Planner in Home per
  // una settimana scoperta specifica — la settimana stagionale (stessa
  // numerazione del Planner), da mostrare in un banner e portare avanti nel
  // link verso il dettaglio attività.
  const weekParam = searchParams.get("week");
  // Se in Home era selezionato un bambino specifico, lo portiamo avanti fino
  // alla Prenotazione (vedi ActivityCardHorizontal/DetailClient/BookingClient).
  const kidParam = searchParams.get("kid");

  const seasonWeekRanges = useMemo(() => getSeasonWeekRanges(seasonYear), [seasonYear]);

  // Filtro DATE reale (prima era un chip "Prossimamente" senza alcun
  // effetto): stato selezionabile a mano dal pannello "Date" E pre-applicato
  // quando si arriva dal Planner ("Riempi") con ?week= in query — in
  // entrambi i casi filtra i risultati alle attività con reale disponibilità
  // (activity_weeks.spots_left > 0) per quella settimana, vedi filteredList.
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(weekParam);
  const selectedWeekInfo = useMemo(() => {
    if (!selectedWeekStart) return null;
    const match = seasonWeekRanges.find((r) => isoDate(r.start) === selectedWeekStart);
    if (!match) return null;
    return { index: match.index, label: `Settimana ${match.index} (${formatShortRange(match.start, match.end)})` };
  }, [selectedWeekStart, seasonWeekRanges]);
  const requestedWeekLabel = selectedWeekInfo?.label ?? null;

  // Bambino target di ?kid= (se presente) — usato solo per l'etichetta nel
  // banner "preferenze di [nome]", il filtro vero e proprio ora vive in
  // selectedTagIds qui sotto (così l'utente può vederlo/modificarlo come
  // filtro "Tipo attività" invece che come effetto invisibile).
  const targetKid = useMemo(() => kids.find((k) => k.id === kidParam) ?? null, [kids, kidParam]);

  // Filtro "Tipo attività" (richiesto da Fabrizio: le preferenze del
  // bambino, impostate nel profilo, erano applicate ma invisibili — ora sono
  // un filtro esplicito per categoria/tag, pre-selezionato con le preferenze
  // del bambino quando si arriva da "Per riempire la settimana N" con ?kid=,
  // ma modificabile a mano come gli altri filtri. Gli interessi sono
  // salvati come stringa "emoji Etichetta" (vedi ProfileKidsSection.tsx): li
  // traduciamo negli id di categoria confrontabili con activity.tagIds.
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
    const kid = kids.find((k) => k.id === kidParam);
    if (!kid?.interests?.length) return [];
    return categories.filter((c) => kid.interests!.includes(`${c.emoji} ${c.label}`)).map((c) => c.id);
  });
  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  // Se non arriviamo da Home con lat/lng nell'URL, riusiamo comunque
  // un'eventuale posizione già rilevata in questa sessione del browser,
  // cosi il filtro geo non si "perde" passando da una pagina all'altra.
  const [fallbackGeo] = useState<{ lat: number; lng: number } | null>(() =>
    latParam === null || lngParam === null ? readStoredGeo() : null
  );
  // Override manuale quando l'utente trascina il pin sulla mappa per
  // correggere la posizione rilevata.
  const [manualGeo, setManualGeo] = useState<{ lat: number; lng: number } | null>(null);
  // La geolocalizzazione va trattata come un filtro "Zona" applicato:
  // deve essere possibile azzerarla esattamente come gli altri filtri.
  const [geoDismissed, setGeoDismissed] = useState(false);

  const baseLat = manualGeo?.lat ?? (latParam !== null ? Number(latParam) : fallbackGeo?.lat);
  const baseLng = manualGeo?.lng ?? (latParam !== null ? Number(lngParam) : fallbackGeo?.lng);
  const lat = geoDismissed ? undefined : baseLat;
  const lng = geoDismissed ? undefined : baseLng;
  const hasGeo = lat !== undefined && lng !== undefined;

  function clearGeo() {
    setGeoDismissed(true);
    setManualGeo(null);
    try {
      sessionStorage.removeItem(GEO_STORAGE_KEY);
    } catch {
      // storage non disponibile, non blocchiamo l'azione
    }
  }

  function updateUserPosition(newLat: number, newLng: number) {
    setManualGeo({ lat: newLat, lng: newLng });
    setGeoDismissed(false);
    try {
      sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify({ lat: newLat, lng: newLng }));
    } catch {
      // storage non disponibile, non blocchiamo l'azione
    }
  }

  const [geoRequest, setGeoRequest] = useState<{ status: "idle" | "loading" | "error"; message?: string }>({
    status: "idle",
  });

  // Permette di attivare la posizione direttamente da Cerca, non solo da
  // Home: utile a chi apre l'app già sul filtro Zona.
  function locateMeInSearch() {
    if (!("geolocation" in navigator)) {
      setGeoRequest({ status: "error", message: "Il browser non supporta la geolocalizzazione." });
      return;
    }
    setGeoRequest({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoRequest({ status: "idle" });
        updateUserPosition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoRequest({
          status: "error",
          message:
            "Posizione non disponibile: controlla i permessi del browser (icona vicino alla barra indirizzi).",
        });
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const [openPanel, setOpenPanel] = useState<FilterPanel>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [query, setQuery] = useState("");
  const [maxAge, setMaxAge] = useState(18);
  const [minAge, setMinAge] = useState(0);
  const [maxPrice, setMaxPrice] = useState(500);
  const [zone, setZone] = useState("");
  const [services, setServices] = useState<ServiceFilters>(EMPTY_SERVICES);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  const zoneOptions = useMemo(() => {
    // Solo vie/zone/comuni, MAI il nome del centro o dell'attività:
    // "a.center" (es. "Centro Sportivo Lido") non entra in questo elenco.
    const set = new Set<string>();
    initialActivities.forEach((a) => {
      if (!a.address) return;
      // l'ultimo pezzo dopo la virgola e' di solito la zona/città, es.
      // "Porta Nuova, Milano" -> "Milano" — teniamo anche l'indirizzo
      // intero come opzione, cosi l'autocomplete copre entrambi i casi.
      set.add(a.address);
      const parts = a.address.split(",").map((p) => p.trim());
      parts.forEach((p) => p && set.add(p));
    });
    return Array.from(set).sort();
  }, [initialActivities]);

  const activeFiltersCount =
    (minAge > 0 || maxAge < 18 ? 1 : 0) +
    (maxPrice < 500 ? 1 : 0) +
    (zone.trim() ? 1 : 0) +
    (hasGeo ? 1 : 0) +
    (selectedWeekStart ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    Object.values(services).filter(Boolean).length;

  const withDistance = useMemo(() => {
    if (!hasGeo) return initialActivities.map((a) => ({ activity: a, distanceKm: a.distanceKm, hasRealDistance: false }));
    return initialActivities.map((a) => ({
      activity: a,
      distanceKm:
        a.lat !== undefined && a.lng !== undefined
          ? Math.round(haversineKm(lat, lng, a.lat, a.lng) * 10) / 10
          : a.distanceKm,
      hasRealDistance: a.lat !== undefined && a.lng !== undefined,
    }));
  }, [initialActivities, hasGeo, lat, lng]);

  // Tutti i filtri "duri" (età/prezzo/zona/servizi), MA senza escludere
  // in base alla distanza: chi cerca vicino al lavoro invece che a casa
  // deve poter vedere comunque le attività più lontane, solo separate.
  const filteredList = useMemo(() => {
    // Attività con disponibilità reale per la settimana selezionata (solo se
    // Supabase è collegato: i dati mock non hanno un dbId da confrontare con
    // activity_weeks, quindi il filtro non si applica in demo).
    const availableIdsForWeek =
      selectedWeekStart && isSupabaseConfigured ? new Set(availabilityByWeek[selectedWeekStart] ?? []) : null;

    return withDistance.filter(({ activity: a }) => {
      if (!a.name.toLowerCase().includes(query.toLowerCase())) return false;
      const [ageMin, ageMax] = parseAgeRange(a.ageRange);
      if (ageMax < minAge || ageMin > maxAge) return false;
      if (a.pricePerWeek > maxPrice) return false;
      if (zone.trim() && !`${a.address} ${a.center}`.toLowerCase().includes(zone.trim().toLowerCase()))
        return false;
      if (services.preScuola && !a.preService?.available) return false;
      if (services.postScuola && !a.postService?.available) return false;
      if (services.pranzo && a.mealOption !== "included" && a.mealOption !== "packed") return false;
      if (services.bar && !a.centerHasBar) return false;
      if (services.attivitaExtra && a.badges.length === 0) return false;
      if (availableIdsForWeek && a.dbId && !availableIdsForWeek.has(a.dbId)) return false;
      if (selectedTagIds.length > 0 && !a.tagIds.some((id) => selectedTagIds.includes(id))) return false;
      return true;
    });
  }, [
    withDistance,
    query,
    minAge,
    maxAge,
    maxPrice,
    zone,
    services,
    selectedWeekStart,
    availabilityByWeek,
    selectedTagIds,
  ]);

  // Se c'e' una posizione, dividiamo in "Nella tua zona" / "Fuori dalla
  // tua zona" invece di far sparire del tutto le attività fuori raggio:
  // può servire vedere proposte vicino al lavoro invece che a casa.
  const { nearby, far } = useMemo(() => {
    if (!hasGeo) return { nearby: filteredList, far: [] as typeof filteredList };
    const nearbyList = filteredList.filter((item) => item.hasRealDistance && item.distanceKm <= radiusKm);
    const farList = filteredList.filter((item) => !item.hasRealDistance || item.distanceKm > radiusKm);
    const byDistance = (x: (typeof filteredList)[number], y: (typeof filteredList)[number]) =>
      x.distanceKm - y.distanceKm;
    return { nearby: [...nearbyList].sort(byDistance), far: [...farList].sort(byDistance) };
  }, [filteredList, hasGeo, radiusKm]);

  const results = useMemo(
    () => (hasGeo ? [...nearby, ...far] : filteredList),
    [hasGeo, nearby, far, filteredList]
  );

  function clearAllFilters() {
    setMinAge(0);
    setMaxAge(18);
    setMaxPrice(500);
    setZone("");
    setServices(EMPTY_SERVICES);
    setOpenPanel(null);
    clearGeo();
    setSelectedWeekStart(null);
    setSelectedTagIds([]);
  }

  const mapItems = useMemo(
    () =>
      results
        .filter(({ activity: a }) => a.lat !== undefined && a.lng !== undefined)
        .map(({ activity: a }) => ({ id: a.id, name: a.name, emoji: a.emoji, lat: a.lat!, lng: a.lng! })),
    [results]
  );

  const filters: { key: FilterPanel; icon: string; label: string }[] = [
    { key: "eta", icon: "ti-users", label: "Età" },
    { key: "prezzo", icon: "ti-coin-euro", label: "Prezzo" },
    { key: "zona", icon: "ti-map-pin", label: hasGeo ? "Zona (vicino a te)" : "Zona" },
    {
      key: "tag",
      icon: "ti-category-2",
      label: selectedTagIds.length > 0 ? `Tipo attività (${selectedTagIds.length})` : "Tipo attività",
    },
    { key: "servizi", icon: "ti-adjustments-horizontal", label: "Servizi" },
    { key: "data", icon: "ti-calendar", label: selectedWeekInfo ? `Settimana ${selectedWeekInfo.index}` : "Date" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex-shrink-0 bg-white px-5 pb-3.5 pt-3">
        <div className="relative">
          <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] py-[11px] pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-sky"
            placeholder="Cerca attività, centri, sport..."
          />
        </div>
        <div className="flex items-center gap-2 pt-2.5">
          {/* Solo questa riga interna scorre in orizzontale: Azzera resta
              fuori dall'area di scroll, quindi sempre visibile a schermo
              invece di finire "in fondo" fuori vista. */}
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {filters.map((f) => (
              <div
                key={f.key}
                onClick={() => setOpenPanel((prev) => (prev === f.key ? null : f.key))}
                className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-medium transition-colors ${
                  openPanel === f.key
                    ? "border-sky bg-sky text-white"
                    : "border-[#E8EBF0] bg-[#F4F6FA] text-ink-2 hover:border-sky hover:bg-sky hover:text-white"
                }`}
              >
                <i className={`ti ${f.icon} text-[13px]`} />
                {f.label}
                {/* La geolocalizzazione applicata da Home si comporta come
                    un filtro Zona: si può azzerare da qui, come gli altri. */}
                {f.key === "zona" && hasGeo && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearGeo();
                    }}
                    className={`ti ti-x flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] ${
                      openPanel === f.key ? "bg-white/25" : "bg-ink-3/20"
                    }`}
                  />
                )}
                {f.key === "data" && selectedWeekStart && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWeekStart(null);
                    }}
                    className={`ti ti-x flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] ${
                      openPanel === f.key ? "bg-white/25" : "bg-ink-3/20"
                    }`}
                  />
                )}
                {f.key === "tag" && selectedTagIds.length > 0 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTagIds([]);
                    }}
                    className={`ti ti-x flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] ${
                      openPanel === f.key ? "bg-white/25" : "bg-ink-3/20"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={clearAllFilters}
            disabled={activeFiltersCount === 0}
            className="flex-shrink-0 whitespace-nowrap pl-1 text-xs font-semibold text-orange disabled:text-ink-3 disabled:opacity-50"
          >
            Azzera{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </button>
        </div>

        {openPanel === "eta" && (
          <div className="mt-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <div className="mb-2 text-xs font-semibold text-ink-2">Fascia d&apos;età</div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-ink-3">Da</label>
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={minAge}
                  onChange={(e) => setMinAge(Math.min(Number(e.target.value), maxAge))}
                  className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
                />
              </div>
              <span className="mt-4 text-ink-3">—</span>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-ink-3">A</label>
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Math.max(Number(e.target.value), minAge))}
                  className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
                />
              </div>
              <span className="mt-4 whitespace-nowrap text-xs text-ink-2">anni</span>
            </div>
          </div>
        )}

        {openPanel === "prezzo" && (
          <div className="mt-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <div className="mb-2 text-xs font-semibold text-ink-2">Fino a €{maxPrice} / settimana</div>
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {openPanel === "zona" && (
          <div className="mt-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              list="zona-suggestions"
              placeholder="Quartiere, via, città..."
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
            />
            <datalist id="zona-suggestions">
              {zoneOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            {!hasGeo && (
              <div className="mt-2.5 border-t border-[#E8EBF0] pt-2.5">
                <button
                  type="button"
                  onClick={locateMeInSearch}
                  disabled={geoRequest.status === "loading"}
                  className="flex items-center gap-1.5 rounded-md bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  <i className="ti ti-current-location text-sm" />
                  {geoRequest.status === "loading" ? "Rilevo la posizione…" : "Usa la mia posizione"}
                </button>
                {geoRequest.status === "error" && (
                  <p className="mt-2 text-[11px] font-medium text-orange">{geoRequest.message}</p>
                )}
              </div>
            )}

            {hasGeo && (
              <div className="mt-2.5 space-y-2 border-t border-[#E8EBF0] pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-ink-3">
                    Posizione rilevata: {lat.toFixed(4)}, {lng.toFixed(4)}
                  </p>
                  <button
                    type="button"
                    onClick={clearGeo}
                    className="text-[11px] font-semibold text-orange"
                  >
                    Rimuovi posizione
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  Considera &quot;nella tua zona&quot; entro
                  <select
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1 text-xs outline-none"
                  >
                    {[2, 5, 10, 20].map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-ink-3">
                  Le attività più lontane non spariscono: restano visibili sotto, in &quot;Fuori dalla tua
                  zona&quot; — utile ad es. per cercare vicino al lavoro invece che a casa. Nella vista
                  Mappa puoi anche trascinare il pin per correggere la posizione.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filtro "Tipo attività" (richiesto da Fabrizio, rinominato da "tag"
            interno a un'etichetta comprensibile): categorie/sport, la stessa
            tassonomia già usata per activity.tagIds. Pre-selezionato con le
            preferenze del bambino quando si arriva da "Per riempire la
            settimana N" (?kid=), ma modificabile liberamente qui. */}
        {openPanel === "tag" && (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <div className="mb-2 text-xs font-semibold text-ink-2">Tipo attività</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const active = selectedTagIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleTag(c.id)}
                    className={`rounded-full border-[1.5px] px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-white text-ink-2"
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
            {targetKid && selectedTagIds.length > 0 && (
              <p className="mt-2.5 text-[11px] text-ink-3">
                Pre-selezionato dalle preferenze di {targetKid.name} — puoi modificarlo liberamente.
              </p>
            )}
          </div>
        )}

        {openPanel === "servizi" && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <ServiceCheckbox
              label="🕗 Pre-scuola"
              checked={services.preScuola}
              onChange={(v) => setServices((s) => ({ ...s, preScuola: v }))}
            />
            <ServiceCheckbox
              label="🕠 Post-scuola"
              checked={services.postScuola}
              onChange={(v) => setServices((s) => ({ ...s, postScuola: v }))}
            />
            <ServiceCheckbox
              label="🍽️ Pranzo incluso"
              checked={services.pranzo}
              onChange={(v) => setServices((s) => ({ ...s, pranzo: v }))}
            />
            <ServiceCheckbox
              label="🥤 Bar nel centro"
              checked={services.bar}
              onChange={(v) => setServices((s) => ({ ...s, bar: v }))}
            />
            <ServiceCheckbox
              label="✨ Attività extra"
              checked={services.attivitaExtra}
              onChange={(v) => setServices((s) => ({ ...s, attivitaExtra: v }))}
            />
          </div>
        )}

        {/* Filtro Date: prima era un chip "Prossimamente" senza alcun
            effetto — ora seleziona una delle 13 settimane stagionali e
            filtra i risultati a chi ha REALMENTE posti liberi in
            quell'intervallo (activity_weeks.spots_left > 0), non solo
            un'etichetta informativa. */}
        {openPanel === "data" && (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <div className="mb-2 text-xs font-semibold text-ink-2">Settimana di camp</div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setSelectedWeekStart(null)}
                className={`block w-full rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  selectedWeekStart === null ? "bg-sky text-white" : "bg-white text-ink-2"
                }`}
              >
                Qualsiasi settimana
              </button>
              {seasonWeekRanges.map((r) => {
                const start = isoDate(r.start);
                const active = selectedWeekStart === start;
                return (
                  <button
                    key={start}
                    type="button"
                    onClick={() => setSelectedWeekStart(active ? null : start)}
                    className={`block w-full rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      active ? "bg-sky text-white" : "bg-white text-ink-2"
                    }`}
                  >
                    Settimana {r.index} · {formatShortRange(r.start, r.end)}
                  </button>
                );
              })}
            </div>
            {!isSupabaseConfigured && (
              <p className="mt-2 text-[11px] text-ink-3">
                In questo ambiente demo il filtro seleziona la settimana ma non riduce i risultati
                (i dati di esempio non hanno una disponibilità reale per settimana).
              </p>
            )}
          </div>
        )}
      </div>

      {(requestedWeekLabel || (targetKid && selectedTagIds.length > 0)) && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#E3F0FB] bg-sky-light px-3.5 py-2.5">
          <span className="text-xs font-semibold text-ink">
            <i className="ti ti-calendar-event mr-1 text-sky" />
            {requestedWeekLabel && `Stai cercando per la ${requestedWeekLabel}`}
            {requestedWeekLabel && targetKid && selectedTagIds.length > 0 && " · "}
            {targetKid && selectedTagIds.length > 0 && `preferenze di ${targetKid.name}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedWeekStart(null);
              setSelectedTagIds([]);
            }}
            className="flex-shrink-0 text-xs font-semibold text-sky"
          >
            Rimuovi
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <span className="text-[13px] text-ink-2">{results.length} attività trovate</span>
        <div className="flex items-center gap-2">
          {hasGeo && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-sky">
              <i className="ti ti-map-pin text-sm" />
              Posizione attiva
            </div>
          )}
          <div className="flex rounded-full border-[1.5px] border-[#E8EBF0] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("lista")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                viewMode === "lista" ? "bg-sky text-white" : "text-ink-2"
              }`}
            >
              <i className="ti ti-list text-sm" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mappa")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                viewMode === "mappa" ? "bg-sky text-white" : "text-ink-2"
              }`}
            >
              <i className="ti ti-map text-sm" />
              Mappa
            </button>
          </div>
        </div>
      </div>

      {viewMode === "mappa" ? (
        <div className="px-5 pb-4">
          <ActivityMap
            items={mapItems}
            userPosition={hasGeo ? { lat, lng } : undefined}
            onUserPositionChange={updateUserPosition}
          />
          {mapItems.length === 0 && (
            <p className="pt-3 text-center text-sm text-ink-2">
              Nessuna attività con coordinate da mostrare in mappa per i filtri scelti.
            </p>
          )}
        </div>
      ) : hasGeo ? (
        <>
          <div className="px-5 pb-1.5 pt-1 text-xs font-bold text-ink-2">
            Nella tua zona (entro {radiusKm} km) — {nearby.length}
          </div>
          {nearby.map(({ activity: a, distanceKm }) => (
            <ActivityCardHorizontal key={a.id} activity={{ ...a, distanceKm }} week={weekParam} kid={kidParam} />
          ))}
          {nearby.length === 0 && (
            <p className="px-5 pb-3 text-sm text-ink-2">Nessuna attività entro {radiusKm} km.</p>
          )}

          {far.length > 0 && (
            <>
              <div className="px-5 pb-1.5 pt-4 text-xs font-bold text-ink-2">
                Fuori dalla tua zona — {far.length}
              </div>
              {far.map(({ activity: a, distanceKm }) => (
                <ActivityCardHorizontal key={a.id} activity={{ ...a, distanceKm }} week={weekParam} kid={kidParam} />
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {results.map(({ activity: a, distanceKm }) => (
            <ActivityCardHorizontal key={a.id} activity={{ ...a, distanceKm }} week={weekParam} kid={kidParam} />
          ))}
          {results.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-2">
              Nessuna attività corrisponde ai filtri scelti.
            </p>
          )}
        </>
      )}
      <div className="h-5" />
    </div>
  );
}

function ServiceCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
