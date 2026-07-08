"use client";

import { useEffect, useMemo } from "react";
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

export interface MapItem {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
}

const MILAN_FALLBACK: [number, number] = [45.4642, 9.19];

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

export default function ActivityMap({
  items,
  userPosition,
  onUserPositionChange,
}: {
  items: MapItem[];
  userPosition?: { lat: number; lng: number };
  onUserPositionChange?: (lat: number, lng: number) => void;
}) {
  const points = useMemo(() => {
    const p: [number, number][] = items.map((it) => [it.lat, it.lng]);
    if (userPosition) p.push([userPosition.lat, userPosition.lng]);
    return p;
  }, [items, userPosition]);

  const center = points[0] || MILAN_FALLBACK;

  return (
    <div className="h-[440px] w-full overflow-hidden rounded-lg border border-[#E8EBF0]">
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {items.map((it) => (
          <Marker key={it.id} position={[it.lat, it.lng]}>
            <Popup>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>
                  {it.emoji} {it.name}
                </strong>
                <br />
                <Link href={`/activity/${it.id}`}>Apri scheda →</Link>
              </div>
            </Popup>
          </Marker>
        ))}
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
