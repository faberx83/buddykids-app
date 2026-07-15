"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Activity, Kid } from "@/lib/types";
import { computeSmartMatches, SmartMatch } from "@/lib/nextgen/smart-search";
import { readStoredGeo, writeStoredGeo, clearStoredGeo, haversineKm } from "@/lib/geo";
import { categories } from "@/lib/mock-data";
import { getSeasonWeekRanges, isoDate, formatShortRange, SeasonWeekRange } from "@/lib/season-weeks";
import ActivityCard from "@/components/ActivityCard";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// Leaflet usa `window`, quindi la mappa va caricata solo lato client — stesso
// pattern già usato in LEGACY (app/(main)/search/SearchClient.tsx) e nel
// Planner NEXTGEN (PlannerMapView.tsx).
const ActivityMap = dynamic(() => import("@/components/ActivityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-full items-center justify-center rounded-lg border border-[#E8EBF0] bg-bg text-sm text-ink-2">
      Carico la mappa…
    </div>
  ),
});

// SPRINT 2 (NEXTGEN) — Ricerca e scoperta: ordinamento intelligente con
// motivazioni leggibili (bambino/vicinanza/settimana scoperta), sopra i dati
// già letti altrove (nessuna query nuova).
//
// SPRINT 5.7 (NEXTGEN) — Fabrizio ha segnalato che i filtri manuali di
// LEGACY (età/prezzo/zona/tipo attività/servizi/data) erano stati
// deliberatamente lasciati fuori dallo scope di Sprint 2, e li ha richiesti
// indietro, insieme a una vista Mappa. Qui i 6 pannelli filtro sono
// ripristinati 1:1 (stessa logica, stessi helper di LEGACY: categories,
// ServiceFilters, parseAgeRange, zona+raggio via haversineKm, le 13
// settimane stagionali) — MA come filtro "duro" applicato PRIMA di
// computeSmartMatches: i filtri escludono i risultati, il motore smart
// continua a occuparsi solo di punteggio/ordinamento/motivazioni sui
// risultati già filtrati. Il motore stesso (lib/nextgen/smart-search.ts) non
// viene toccato.
type FilterPanel = "eta" | "prezzo" | "zona" | "tag" | "servizi" | "data" | null;
type ViewMode = "lista" | "mappa";
type GeoStatus = "idle" | "loading" | "error";

interface ServiceFilters {
  preScuola: boolean;
  postScuola: boolean;
  pranzo: boolean;
  bar: boolean;
  attivitaExtra: boolean;
  // SPRINT CORRETTIVO (feedback Fabrizio): "aggiungi flag per disabili e
  // diete speciali (usa stessa naming ovunque)" — stesso naming/dati già
  // usati per i badge su ActivityCard.tsx ("Accesso disabili",
  // "Diete gestite", da activity.centerAccessible/dietaryOptions), qui come
  // filtro invece che solo badge informativo.
  accessoDisabili: boolean;
  dieteGestite: boolean;
}

const EMPTY_SERVICES: ServiceFilters = {
  preScuola: false,
  postScuola: false,
  pranzo: false,
  bar: false,
  attivitaExtra: false,
  accessoDisabili: false,
  dieteGestite: false,
};

const DEFAULT_RADIUS_KM = 5;

function parseAgeRange(ageRange: string): [number, number] {
  const match = ageRange.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return [0, 99];
  return [Number(match[1]), Number(match[2])];
}

// SPRINT 3 (feedback Fabrizio: "il filtro settimana dovrebbe permettere
// multi-selezione, raggruppata per mese") — piccola funzione pura duplicata
// qui (stessa convenzione già usata altrove nel repo, es.
// lib/nextgen/planner-insights.ts#groupWeeksByMonth): raggruppa le 13
// SeasonWeekRange per mese di inizio, preservando l'ordine cronologico.
const MONTH_LABELS_IT_FULL = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

interface WeekRangeMonthGroup {
  monthLabel: string;
  ranges: SeasonWeekRange[];
}

function groupWeekRangesByMonth(ranges: SeasonWeekRange[]): WeekRangeMonthGroup[] {
  const groups: WeekRangeMonthGroup[] = [];
  let lastMonth = -1;
  for (const r of ranges) {
    const month = r.start.getUTCMonth();
    if (month !== lastMonth) {
      groups.push({ monthLabel: MONTH_LABELS_IT_FULL[month], ranges: [] });
      lastMonth = month;
    }
    groups[groups.length - 1].ranges.push(r);
  }
  return groups;
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

function ResultCard({ match }: { match: SmartMatch }) {
  return (
    <div>
      {match.reasons.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1 px-1">
          {match.reasons.map((reason) => (
            <span key={reason} className="rounded-full bg-trama-lilac/20 px-2 py-0.5 text-[10px] font-semibold text-trama-violet">
              {reason}
            </span>
          ))}
        </div>
      )}
      <ActivityCard activity={match.activity} matchPercent={Math.min(99, Math.round(match.score))} />
    </div>
  );
}

export default function SearchDiscoveryClient({
  activities,
  kids,
  seasonYear,
  uncoveredWeekStart,
  uncoveredWeekLabel,
  availabilityByWeek,
}: {
  activities: Activity[];
  kids: Kid[];
  seasonYear: number;
  uncoveredWeekStart: string | null;
  uncoveredWeekLabel: string | null;
  availabilityByWeek: Record<string, string[]>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);

  const [openPanel, setOpenPanel] = useState<FilterPanel>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(18);
  const [maxPrice, setMaxPrice] = useState(500);
  const [zone, setZone] = useState("");
  const [services, setServices] = useState<ServiceFilters>(EMPTY_SERVICES);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // SPRINT 3 (feedback Fabrizio: "il filtro settimana dovrebbe permettere di
  // selezionare più settimane, non solo una") — da singolo valore ad array;
  // un'attività passa il filtro se disponibile in ALMENO UNA delle settimane
  // scelte (unione, non intersezione: si sta chiedendo "quali settimane mi
  // interessano", non "disponibile in tutte").
  const [selectedWeekStarts, setSelectedWeekStarts] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(() => readStoredGeo());
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const hasGeo = geo !== null;

  function updateUserPosition(lat: number, lng: number) {
    setGeo({ lat, lng });
    writeStoredGeo(lat, lng);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoError("Il browser non supporta la geolocalizzazione.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus("idle");
        updateUserPosition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoStatus("error");
        setGeoError("Posizione non disponibile: controlla i permessi del browser.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function clearGeo() {
    setGeo(null);
    setGeoStatus("idle");
    clearStoredGeo();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  function toggleWeek(start: string) {
    setSelectedWeekStarts((prev) => (prev.includes(start) ? prev.filter((s) => s !== start) : [...prev, start]));
  }

  // SPRINT 3 (feedback Fabrizio: "il filtro bambino potrebbe stare nella
  // stessa riga scorrevole") — ora che il chip bambino vive nella stessa
  // riga di filters/Azzera, "Azzera" resetta anche la selezione bambino
  // (torna a "Tutti i bambini"), coerente con l'idea che sia parte dello
  // stesso set di filtri visibile in un colpo d'occhio.
  function clearAllFilters() {
    setMinAge(0);
    setMaxAge(18);
    setMaxPrice(500);
    setZone("");
    setServices(EMPTY_SERVICES);
    setSelectedTagIds([]);
    setSelectedWeekStarts([]);
    setSelectedKidId(null);
    setOpenPanel(null);
    clearGeo();
  }

  const seasonWeekRanges = useMemo(() => getSeasonWeekRanges(seasonYear), [seasonYear]);
  const weekRangeGroups = useMemo(() => groupWeekRangesByMonth(seasonWeekRanges), [seasonWeekRanges]);

  const zoneOptions = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (!a.address) return;
      set.add(a.address);
      a.address
        .split(",")
        .map((p) => p.trim())
        .forEach((p) => p && set.add(p));
    });
    return Array.from(set).sort();
  }, [activities]);

  const activeFiltersCount =
    (minAge > 0 || maxAge < 18 ? 1 : 0) +
    (maxPrice < 500 ? 1 : 0) +
    (zone.trim() ? 1 : 0) +
    (hasGeo ? 1 : 0) +
    (selectedWeekStarts.length > 0 ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    (selectedKidId !== null ? 1 : 0) +
    Object.values(services).filter(Boolean).length;

  const selectedKids = useMemo(
    () => (selectedKidId ? kids.filter((k) => k.id === selectedKidId) : kids),
    [kids, selectedKidId]
  );

  // Filtri "duri" (età/prezzo/zona/servizi/tipo attività/settimana/nome) —
  // escludono i risultati PRIMA dello scoring smart, stessa logica di
  // filteredList in LEGACY.
  const filteredActivities = useMemo(() => {
    // SPRINT 3 — multi-selezione: unione dei posti disponibili su TUTTE le
    // settimane scelte (un'attività passa se libera in almeno una).
    const availableIdsForWeeks =
      selectedWeekStarts.length > 0
        ? new Set(selectedWeekStarts.flatMap((s) => availabilityByWeek[s] ?? []))
        : null;
    const q = query.trim().toLowerCase();

    return activities.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      const [ageMin, ageMax] = parseAgeRange(a.ageRange);
      if (ageMax < minAge || ageMin > maxAge) return false;
      if (a.pricePerWeek > maxPrice) return false;
      if (zone.trim() && !`${a.address} ${a.center}`.toLowerCase().includes(zone.trim().toLowerCase())) return false;
      if (services.preScuola && !a.preService?.available) return false;
      if (services.postScuola && !a.postService?.available) return false;
      if (services.pranzo && a.mealOption !== "included" && a.mealOption !== "packed") return false;
      if (services.bar && !a.centerHasBar) return false;
      if (services.attivitaExtra && a.badges.length === 0) return false;
      if (services.accessoDisabili && !a.centerAccessible) return false;
      if (services.dieteGestite && !(a.dietaryOptions && a.dietaryOptions.length > 0)) return false;
      if (availableIdsForWeeks && a.dbId && !availableIdsForWeeks.has(a.dbId)) return false;
      if (selectedTagIds.length > 0 && !a.tagIds.some((id) => selectedTagIds.includes(id))) return false;
      return true;
    });
  }, [activities, query, minAge, maxAge, maxPrice, zone, services, selectedTagIds, selectedWeekStarts, availabilityByWeek]);

  const matches = useMemo(
    () => computeSmartMatches(filteredActivities, selectedKids, { geo, uncoveredWeekStart, availabilityByWeek }),
    [filteredActivities, selectedKids, geo, uncoveredWeekStart, availabilityByWeek]
  );

  // Se c'è una posizione, dividiamo "Nella tua zona" / "Fuori dalla tua
  // zona" invece di escludere del tutto le attività fuori raggio (stesso
  // principio di LEGACY) — l'ordinamento smart resta invariato DENTRO
  // ciascun gruppo.
  const { nearby, far } = useMemo(() => {
    if (!geo) return { nearby: matches, far: [] as SmartMatch[] };
    const nearbyList: SmartMatch[] = [];
    const farList: SmartMatch[] = [];
    for (const m of matches) {
      const hasCoords = m.activity.lat !== undefined && m.activity.lng !== undefined;
      const km = hasCoords ? haversineKm(geo.lat, geo.lng, m.activity.lat!, m.activity.lng!) : null;
      if (km !== null && km <= radiusKm) nearbyList.push(m);
      else farList.push(m);
    }
    return { nearby: nearbyList, far: farList };
  }, [matches, geo, radiusKm]);

  const mapItems = useMemo(
    () =>
      matches
        .filter((m) => m.activity.lat !== undefined && m.activity.lng !== undefined)
        .map((m) => ({ id: m.activity.id, name: m.activity.name, emoji: m.activity.emoji, lat: m.activity.lat!, lng: m.activity.lng! })),
    [matches]
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
    {
      key: "data",
      icon: "ti-calendar",
      label: selectedWeekStarts.length > 0 ? `Settimane (${selectedWeekStarts.length})` : "Date",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Scopri attività" onBack={() => router.push("/nextgen")} showBrandIcon />
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-ink-2">
            Ordinati per voi{uncoveredWeekLabel ? ` — priorità a chi è libero in ${uncoveredWeekLabel}` : ""}.
          </p>
          <NextgenBadge />
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome…"
          className="mb-3 w-full rounded-xl border border-[#E8EBF0] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-trama-violet"
        />

        {/* SPRINT 5.7 — 6 pannelli filtro ripristinati da LEGACY (età, prezzo,
            zona+raggio, tipo attività, servizi, data), applicati come filtro
            "duro" prima dello scoring smart.
            SPRINT 3 (feedback Fabrizio: "il filtro bambino potrebbe stare
            nella stessa riga scorrevole dei filtri, invece che in un blocco
            a parte sopra") — i chip bambino sono ora i primi elementi della
            STESSA riga scorrevole, con un separatore verticale leggero prima
            dei filtri veri e propri, invece di un blocco flex-wrap separato
            sopra. */}
        <div className="mb-1 flex items-center gap-2">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {kids.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedKidId(null)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedKidId === null ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
                  }`}
                >
                  Tutti i bambini
                </button>
                {kids.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSelectedKidId(k.id)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedKidId === k.id ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {k.name}
                  </button>
                ))}
                <div className="mx-0.5 h-5 w-px flex-shrink-0 bg-[#E8EBF0]" />
              </>
            )}
            {filters.map((f) => (
              <div
                key={f.key}
                onClick={() => setOpenPanel((prev) => (prev === f.key ? null : f.key))}
                className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-medium transition-colors ${
                  openPanel === f.key
                    ? "border-trama-violet bg-trama-violet text-white"
                    : "border-[#E8EBF0] bg-[#F4F6FA] text-ink-2 hover:border-trama-violet hover:bg-trama-violet hover:text-white"
                }`}
              >
                <i className={`ti ${f.icon} text-[13px]`} />
                {f.label}
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
                {f.key === "data" && selectedWeekStarts.length > 0 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWeekStarts([]);
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
          {/* SPRINT 3 (feedback Fabrizio: "'Azzera' dovrebbe sparire del
              tutto quando non ci sono filtri attivi, non solo restare
              grigio/disabilitato") — prima il bottone era sempre montato,
              solo visivamente disabilitato. */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex-shrink-0 whitespace-nowrap pl-1 text-xs font-semibold text-trama-orange"
            >
              Azzera ({activeFiltersCount})
            </button>
          )}
        </div>

        {openPanel === "eta" && (
          <div className="mb-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
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
                  className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-trama-violet"
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
                  className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-trama-violet"
                />
              </div>
              <span className="mt-4 whitespace-nowrap text-xs text-ink-2">anni</span>
            </div>
          </div>
        )}

        {openPanel === "prezzo" && (
          <div className="mb-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
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
          <div className="mb-3 rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              list="zona-suggestions-nextgen"
              placeholder="Quartiere, via, città..."
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-trama-violet"
            />
            <datalist id="zona-suggestions-nextgen">
              {zoneOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            {!hasGeo && (
              <div className="mt-2.5 border-t border-[#E8EBF0] pt-2.5">
                <button
                  type="button"
                  onClick={locateMe}
                  disabled={geoStatus === "loading"}
                  className="flex items-center gap-1.5 rounded-md bg-trama-violet px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  <i className="ti ti-current-location text-sm" />
                  {geoStatus === "loading" ? "Rilevo la posizione…" : "Usa la mia posizione"}
                </button>
                {geoStatus === "error" && geoError && (
                  <p className="mt-2 text-[11px] font-medium text-trama-orange">{geoError}</p>
                )}
              </div>
            )}

            {hasGeo && geo && (
              <div className="mt-2.5 space-y-2 border-t border-[#E8EBF0] pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-ink-3">
                    Posizione rilevata: {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
                  </p>
                  <button type="button" onClick={clearGeo} className="text-[11px] font-semibold text-trama-orange">
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
                  zona&quot;. Nella vista Mappa puoi anche trascinare il pin per correggere la posizione.
                </p>
              </div>
            )}
          </div>
        )}

        {openPanel === "tag" && (
          <div className="mb-3 max-h-64 overflow-y-auto rounded-lg border border-[#E8EBF0] bg-bg p-3">
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
                      active ? "border-trama-violet bg-trama-violet text-white" : "border-[#E8EBF0] bg-white text-ink-2"
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {openPanel === "servizi" && (
          <div className="mb-3 space-y-1.5 rounded-lg border border-[#E8EBF0] bg-bg p-3">
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
            {/* SPRINT 5 (feedback Fabrizio): "aggiungi flag per disabili e diete
                speciali (usa stessa naming ovunque)" — stessa label usata da
                ActivityCard.tsx, così il badge sulla card e il filtro qui
                restano coerenti.
                SPRINT 3 — wording allineato al restyle badge: "Nessuna
                limitazione" invece di "Accesso disabili" (il campo dati
                accessoDisabili/centerAccessible resta invariato). */}
            <ServiceCheckbox
              label="🤝 Nessuna limitazione"
              checked={services.accessoDisabili}
              onChange={(v) => setServices((s) => ({ ...s, accessoDisabili: v }))}
            />
            <ServiceCheckbox
              label="🥗 Diete gestite"
              checked={services.dieteGestite}
              onChange={(v) => setServices((s) => ({ ...s, dieteGestite: v }))}
            />
            <ServiceCheckbox
              label="✨ Attività extra"
              checked={services.attivitaExtra}
              onChange={(v) => setServices((s) => ({ ...s, attivitaExtra: v }))}
            />
          </div>
        )}

        {/* SPRINT 3 (feedback Fabrizio: "il filtro settimana dovrebbe
            permettere multi-selezione, con un raggruppamento mese →
            settimana") — da singolo bottone "attivo" a multi-selezione
            (ogni settimana si accende/spegne in modo indipendente), con le
            13 settimane raggruppate per mese invece di una lista piatta. */}
        {openPanel === "data" && (
          <div className="mb-3 max-h-72 overflow-y-auto rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-ink-2">Settimane di camp</div>
              {selectedWeekStarts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedWeekStarts([])}
                  className="text-[11px] font-semibold text-trama-orange"
                >
                  Qualsiasi settimana
                </button>
              )}
            </div>
            <div className="space-y-3">
              {weekRangeGroups.map((group) => (
                <div key={group.monthLabel}>
                  <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                    {group.monthLabel}
                  </div>
                  <div className="space-y-1.5">
                    {group.ranges.map((r) => {
                      const start = isoDate(r.start);
                      const active = selectedWeekStarts.includes(start);
                      return (
                        <button
                          key={start}
                          type="button"
                          onClick={() => toggleWeek(start)}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
                            active ? "bg-trama-violet text-white" : "bg-white text-ink-2"
                          }`}
                        >
                          <span>
                            Settimana {r.index} · {formatShortRange(r.start, r.end)}
                          </span>
                          {active && <i className="ti ti-check text-sm" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12.5px] text-ink-2">{matches.length} attività trovate</span>
          <div className="flex items-center gap-2">
            {hasGeo && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-trama-violet">
                <i className="ti ti-map-pin text-sm" />
                Posizione attiva
              </div>
            )}
            <div className="flex rounded-full border-[1.5px] border-[#E8EBF0] p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode("lista")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                  viewMode === "lista" ? "bg-trama-violet text-white" : "text-ink-2"
                }`}
              >
                <i className="ti ti-list text-sm" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mappa")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                  viewMode === "mappa" ? "bg-trama-violet text-white" : "text-ink-2"
                }`}
              >
                <i className="ti ti-map text-sm" />
                Mappa
              </button>
            </div>
          </div>
        </div>

        {viewMode === "mappa" ? (
          <div>
            <ActivityMap items={mapItems} userPosition={geo ?? undefined} onUserPositionChange={updateUserPosition} />
            {mapItems.length === 0 && (
              <p className="pt-3 text-center text-sm text-ink-2">
                Nessuna attività con coordinate da mostrare in mappa per i filtri scelti.
              </p>
            )}
          </div>
        ) : matches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Nessuna attività corrisponde ai filtri scelti.
          </p>
        ) : hasGeo ? (
          <div className="flex flex-col gap-1">
            <div className="pb-1.5 pt-1 text-xs font-bold text-ink-2">
              Nella tua zona (entro {radiusKm} km) — {nearby.length}
            </div>
            {nearby.map((m) => (
              <ResultCard key={m.activity.id} match={m} />
            ))}
            {nearby.length === 0 && <p className="pb-3 text-sm text-ink-2">Nessuna attività entro {radiusKm} km.</p>}

            {far.length > 0 && (
              <>
                <div className="pb-1.5 pt-4 text-xs font-bold text-ink-2">Fuori dalla tua zona — {far.length}</div>
                {far.map((m) => (
                  <ResultCard key={m.activity.id} match={m} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {matches.map((m) => (
              <ResultCard key={m.activity.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
