"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet cerca di default le immagini dei marker in un percorso relativo
// che i bundler (Next/webpack) non risolvono correttamente. Le puntiamo
// esplicitamente a una CDN invece di dover configurare il bundler.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#4DAFEF;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// SPRINT CORRETTIVO (feedback Fabrizio, mockup "3. Mappa" del Planner): "il
// PIN una volta cliccato deve essere evidenziato" — pin selezionato più
// grande e nel viola del brand, invece del marker rosso di default di
// Leaflet. Usato SOLO quando viene passato `selectedId` (opt-in, vedi sotto):
// LEGACY Cerca non passa questa prop, quindi il suo comportamento resta
// identico a prima.
const selectedIcon = L.divIcon({
  className: "",
  html: '<div style="width:26px;height:26px;border-radius:9999px;background:#6F63C5;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// TRAMA — DISCOVERY MAP + POLISH (21/09/2026), §3-4 del prompt "TRE STATI
// MAPPA" / "MAP LEGEND". Due nuove icone, entrambe visivamente distinte dal
// marker TRAMA di default (Leaflet standard, invariato — "NON cambiare
// arbitrariamente il comportamento dei marker test esistenti") e distinte
// TRA loro (§3B: "Marker DEVE essere visivamente distinguibile da FULL
// TRAMA"; §3C: "Marker distinto anche da B"). Stessa forma (divIcon
// circolare, stesso pattern di userIcon/selectedIcon sopra), solo colore e
// dimensione diversi — nessun asset immagine nuovo da caricare.
const curatedInvitableIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#F2994A;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const curatedSourceIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#8B93A3;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.3)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// TRAMA — DISCOVERY FINAL UX PASS (22/09/2026), §2 "FULL TRAMA MARKER COLOR
// — AUDIT". ROOT CAUSE del disallineamento legend/marker: la legenda
// (SearchDiscoveryClient.tsx) mostra un pallino viola (#6F63C5, stesso
// colore di `selectedIcon` sopra) per "TRAMA", ma il ramo `markerKind ===
// "partner"` qui sotto non aveva MAI un'icona dedicata — cadeva nel
// fallback `{}` che lascia Leaflet usare la sua icona di default
// (marker-icon.png, il classico pin BLU di Leaflet), mai stata cambiata
// perché quell'icona di default serve ANCHE a PlannerMapView/LEGACY Cerca
// (che non passano mai `markerKind` — vedi MapItem sopra), dove deve
// restare esattamente com'era. Fix mirato: una nuova icona SOLO per
// `markerKind === "partner"` (stesso viola brand della legenda e di
// `selectedIcon`, dimensione intermedia tra le due icone Curated per
// restare il marker "principale") — il ramo undefined/PlannerMapView
// continua a usare il default Leaflet blu, invariato.
const tramaPartnerIcon = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#6F63C5;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export interface MapItem {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  // TRAMA — DISCOVERY MAP + POLISH (21/09/2026), §9 "MAP RESULT MODEL".
  // Entrambi FACOLTATIVI e RETROCOMPATIBILI: quando assenti (PlannerMapView,
  // LEGACY Cerca), il comportamento resta ESATTAMENTE quello di prima
  // (icona di default, popup "nome + Apri scheda"). `markerKind` sceglie
  // solo l'icona; `popupContent`, quando presente, SOSTITUISCE il contenuto
  // del popup di default — usato per i marker Curated, il cui popup non può
  // MAI riusare il link "Apri scheda" (nessuna route /activity/[id] esiste
  // per un lead curato).
  markerKind?: "partner" | "curated_invitable" | "curated_source";
  popupContent?: ReactNode;
}

const MILAN_FALLBACK: [number, number] = [45.4642, 9.19];

// TRAMA — DISCOVERY FINAL UX PASS (22/09/2026), §6 "MAP FIT / INITIAL VIEW"
// — AUDIT: questo componente già riceveva TUTTI i punti passati in `items`
// (FULL TRAMA + Da invitare + Fonte pubblica indistintamente, nessun filtro
// per tipo qui) e già ricalcolava SOLO quando l'array `points` cambia
// valore (`JSON.stringify(points)` nelle dep — un pan/zoom manuale
// dell'utente non tocca mai `points`, quindi non fa mai ripartire
// `fitBounds`). L'aspetto "marker molto concentrati" negli screenshot era
// riconducibile al layer cartografico rotto (§1, watermark "API KEY
// REQUIRED" sopra ai tile) combinato con la reale distribuzione geografica
// del dataset (cluster Milano + 2 lead Puglia a ~800km, che allargano
// legittimamente i bounds quando compaiono insieme in un risultato non
// filtrato) — non un bug di fitBounds. Unica modifica: un `maxZoom` di
// sicurezza, cosi un cluster molto stretto (es. le 2 sedi del multi-sede
// Municipio 7, poche centinaia di metri) non zooma MAI oltre un livello
// leggibile, coerente con "zoom ragionevole, non eccessivo" richiesto anche
// per il caso a un solo marker qui sotto.
// TRAMA — DISCOVERY LIVE UX BUGFIX (22/09/2026), §3 "RETURN FROM ACTIVITY
// DETAIL — RESTORE MAP STATE". Nuovo prop opzionale `skip`, additivo:
// quando true, il PRIMO run dell'effect non chiama fitBounds/setView — serve
// a non sovrascrivere subito un pan/zoom ripristinato da
// SearchDiscoveryClient (`initialViewState`, sotto) con il fit automatico
// sui bounds dei risultati. Il ref garantisce che questo valga SOLO per il
// primo run: un cambio filtri successivo (che cambia `points`) fa scattare
// di nuovo fitBounds normalmente, comportamento invariato per ogni caso che
// non parte da uno stato ripristinato (skip assente/false → identico a
// prima, nessuna regressione per PlannerMapView/LEGACY Cerca che non passano
// questo prop).
function FitBounds({ points, skip }: { points: [number, number][]; skip?: boolean }) {
  const map = useMap();
  const isFirstRun = useRef(true);
  useEffect(() => {
    const wasFirstRun = isFirstRun.current;
    isFirstRun.current = false;
    if (wasFirstRun && skip) return;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [32, 32], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

// TRAMA — DISCOVERY LIVE UX BUGFIX (22/09/2026), §3. Riporta al genitore il
// centro/zoom SCELTO MANUALMENTE dall'utente (pan/zoom), cosi
// SearchDiscoveryClient può persisterlo nell'URL (`router.replace`, mai una
// nuova riga DB/localStorage) e ripassarlo come `initialViewState` al
// prossimo mount di questo componente (es. dopo un Back dal dettaglio
// attività). Solo `moveend`/`zoomend` (fine gesto), mai eventi continui
// (`move`/`zoom`) — evita di rigenerare l'URL decine di volte durante un
// singolo trascinamento.
function ViewStateReporter({ onChange }: { onChange: (center: [number, number], zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onChange([c.lat, c.lng], map.getZoom());
    },
    zoomend: () => {
      const c = map.getCenter();
      onChange([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

export default function ActivityMap({
  items,
  userPosition,
  onUserPositionChange,
  height = 440,
  selectedId,
  onSelect,
  initialViewState,
  skipInitialFit,
  onViewStateChange,
}: {
  items: MapItem[];
  userPosition?: { lat: number; lng: number };
  onUserPositionChange?: (lat: number, lng: number) => void;
  // SPRINT CORRETTIVO (Planner - Mappa) — tutti opt-in, default invariati:
  // `height` sostituisce il fisso 440px SOLO se passato (Cerca/LEGACY non lo
  // passa); `selectedId`/`onSelect` abilitano l'evidenziazione del pin
  // cliccato — quando `onSelect` è assente (Cerca) il Popup di Leaflet resta
  // il comportamento di sempre.
  height?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  // TRAMA — DISCOVERY LIVE UX BUGFIX (22/09/2026), §3 "RETURN FROM ACTIVITY
  // DETAIL — RESTORE MAP STATE". Tutti e tre opt-in/additivi, nessun default
  // cambiato per PlannerMapView/LEGACY Cerca (che non li passano): quando
  // `initialViewState` è assente, `MapContainer` usa lo stesso center/zoom
  // di sempre (primo punto/fallback Milano, zoom 12) e FitBounds si
  // comporta esattamente come prima.
  initialViewState?: { center: [number, number]; zoom: number };
  skipInitialFit?: boolean;
  onViewStateChange?: (center: [number, number], zoom: number) => void;
}) {
  const points = useMemo(() => {
    const p: [number, number][] = items.map((it) => [it.lat, it.lng]);
    if (userPosition) p.push([userPosition.lat, userPosition.lng]);
    return p;
  }, [items, userPosition]);

  const center = initialViewState?.center ?? points[0] ?? MILAN_FALLBACK;
  const zoom = initialViewState?.zoom ?? 12;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#E8EBF0]" style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        {/* TRAMA — DISCOVERY LIVE UX BUGFIX (22/09/2026), §1 "MAP TILE LAYER
            — BLOCKER". Cronologia di questo layer, entrambe le cause
            verificate LIVE in browser (non solo da documentazione):
            (1) basemaps.cartocdn.com (CARTO) — da agosto 2026 richiede una
                API key: senza, ogni tile tornava il watermark "API KEY
                REQUIRED" (fix del FINAL UX PASS precedente).
            (2) maps.wikimedia.org/osm-intl — la documentazione pubblica lo
                descrive come "nessuna API key richiesta", ma la verifica
                LIVE in browser (navigazione diretta a un tile reale) ha
                restituito HTTP 403 con corpo "Forbidden: Map tiles are
                restricted to Wikimedia and affiliated sites only" — un
                sito esterno come TRAMA non è autorizzato, a prescindere da
                referrer/config: root cause del "basemap grigio" (Leaflet
                riceve 403 invece del PNG, mostra il grigio di sfondo del
                tile pane senza errore bloccante). Non risolvibile restando
                su questo host.
            FIX: OpenStreetMap standard (tile.openstreetmap.org) — VERIFICATO
            LIVE (navigazione diretta a un tile reale → HTTP 200, PNG
            renderizzato correttamente). Host CANONICO SINGOLO (non più il
            pattern {s}.tile.openstreetmap.org con sub-domain sharding,
            deprecato — la Tile Usage Policy ufficiale, letta in questa
            sessione, indica esplicitamente l'host singolo come quello
            attuale: "altri sottodomini possono essere più lenti o
            ritirati"). Nessuna API key. La stessa policy richiede un Referer
            identificabile (mai "no-referrer"): next.config.mjs di questo
            progetto non imposta alcun Referrer-Policy custom, quindi il
            browser usa il default moderno (strict-origin-when-cross-origin)
            — esplicitamente tra i valori accettati dalla policy — reso
            comunque esplicito qui con `referrerPolicy="origin"` sul
            TileLayer invece di affidarsi solo al default silenzioso.
            Uso moderato (pilota interno, non scraping bulk) è in linea con
            l'uso "compatibile con l'utilizzo occasionale" previsto dalla
            policy per applicazioni di terze parti. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          referrerPolicy="origin"
          maxZoom={19}
        />
        <FitBounds points={points} skip={skipInitialFit} />
        {onViewStateChange && <ViewStateReporter onChange={onViewStateChange} />}
        {items.map((it) =>
          onSelect ? (
            // BUGFIX (segnalato da Fabrizio: la Mappa crasha sempre, sia web
            // che PWA, appena si apre) — react-leaflet passa "icon" così
            // com'è dentro `new L.Marker(position, options)`; Leaflet applica
            // le options con un `for...in`, che copia la chiave "icon" anche
            // quando vale `undefined`, sovrascrivendo l'icona di default e
            // facendo esplodere `_initIcon` (chiama `.createIcon()` su
            // `undefined`). Prima capitava per OGNI marker non selezionato,
            // cioè sempre al primo render (nessun pin ancora scelto). Fix:
            // passare la prop "icon" solo quando c'è davvero un'icona da
            // sovrascrivere, così quando non è passata affatto Leaflet usa
            // correttamente il suo default.
            <Marker
              key={it.id}
              position={[it.lat, it.lng]}
              {...(selectedId === it.id ? { icon: selectedIcon } : {})}
              eventHandlers={{ click: () => onSelect(it.id) }}
            />
          ) : (
            <Marker
              key={it.id}
              position={[it.lat, it.lng]}
              {...(it.markerKind === "curated_invitable"
                ? { icon: curatedInvitableIcon }
                : it.markerKind === "curated_source"
                  ? { icon: curatedSourceIcon }
                  : it.markerKind === "partner"
                    ? { icon: tramaPartnerIcon }
                    : {})}
            >
              <Popup>
                {it.popupContent ?? (
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>
                      {it.emoji} {it.name}
                    </strong>
                    <br />
                    <Link href={`/activity/${it.id}`}>Apri scheda →</Link>
                  </div>
                )}
              </Popup>
            </Marker>
          )
        )}
        {userPosition && (
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={userIcon}
            draggable={Boolean(onUserPositionChange)}
            eventHandlers={
              onUserPositionChange
                ? {
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      onUserPositionChange(lat, lng);
                    },
                  }
                : undefined
            }
          >
            <Popup>
              La tua posizione
              {onUserPositionChange ? " — trascina il pin per correggerla" : ""}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
