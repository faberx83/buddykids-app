"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
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

export default function ActivityMap({
  items,
  userPosition,
  onUserPositionChange,
  height = 440,
  selectedId,
  onSelect,
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
}) {
  const points = useMemo(() => {
    const p: [number, number][] = items.map((it) => [it.lat, it.lng]);
    if (userPosition) p.push([userPosition.lat, userPosition.lng]);
    return p;
  }, [items, userPosition]);

  const center = points[0] || MILAN_FALLBACK;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#E8EBF0]" style={{ height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        {/* TRAMA — DISCOVERY FINAL UX PASS (22/09/2026), §1 "API KEY
            REQUIRED — FIX OBBLIGATORIO". ROOT CAUSE: CARTO ha cambiato
            policy ad agosto 2026 — basemaps.cartocdn.com (il tile
            "light_all" usato qui) non è più anonimo/gratuito senza
            registrazione: senza una API key ogni tile torna un watermark
            "API KEY REQUIRED" invece della mappa reale (confermato via
            ricerca: CARTO Basemaps FAQ + numerosi issue pubblici di altri
            progetti Leaflet colpiti dallo stesso cambiamento). Impossibile
            "fixare" restando su questo host senza una key.
            FIX: sostituito con i tile Wikimedia Maps (stile "osm-intl",
            stessa fonte dati OpenStreetMap, stile chiaro/desaturato
            equivalente a Positron) — servizio pubblico, documentato, senza
            API key, stesso pattern raster XYZ già in uso (nessuna nuova
            dipendenza, nessun secret nel client, nessuna riapertura
            dell'architettura). Attribution aggiornata secondo le linee guida
            ufficiali Wikimedia Maps (nome del servizio + credito OSM). Se in
            futuro serve tornare a CARTO, serve una API key CARTO Basemaps
            (gratuita fino a 5M richieste/mese, ma da configurare come env
            var — es. NEXT_PUBLIC_CARTO_API_KEY — MAI hardcoded nel client):
            non implementato qui, restiamo sul provider senza key. */}
        <TileLayer
          attribution='Wikimedia maps beta | Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <FitBounds points={points} />
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
