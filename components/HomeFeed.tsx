"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityCard from "@/components/ActivityCard";
import CategoryChip from "@/components/CategoryChip";
import { Activity, Tag } from "@/lib/types";
import { haversineKm } from "@/lib/geo";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; lat: number; lng: number; nearbyCount: number }
  | { status: "error"; message: string };

const GEO_STORAGE_KEY = "bk_last_geo";

function readStoredGeo(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
  } catch {
    // storage non disponibile o dato corrotto: ignoriamo, si richiede di nuovo
  }
  return null;
}

export default function HomeFeed({
  activities,
  categories,
}: {
  activities: Activity[];
  categories: Tag[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Se la posizione era già stata rilevata in questa sessione del browser
  // (es. tornando da Cerca), la recuperiamo invece di far ricliccare l'utente
  // su "Usa posizione" ad ogni navigazione.
  const [geo, setGeo] = useState<GeoState>(() => {
    const stored = readStoredGeo();
    if (!stored) return { status: "idle" };
    const nearbyCount = activities.filter(
      (a) => a.lat !== undefined && a.lng !== undefined && haversineKm(stored.lat, stored.lng, a.lat, a.lng) <= 5
    ).length;
    return { status: "done", lat: stored.lat, lng: stored.lng, nearbyCount };
  });

  const filtered = useMemo(
    () =>
      selectedCategory ? activities.filter((a) => a.tagIds.includes(selectedCategory)) : activities,
    [activities, selectedCategory]
  );

  // "Popolari" — interim: ordiniamo per rating e numero recensioni reali
  // (unico segnale di popolarità già presente nei dati oggi) invece di
  // prendere semplicemente le prime due della lista. La definizione
  // definitiva (es. basata su prenotazioni reali) resta da chiarire.
  const sortedByPopularity = useMemo(
    () =>
      [...filtered].sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount),
    [filtered]
  );
  const popular = sortedByPopularity.slice(0, 2);
  const recommended = sortedByPopularity.slice(2, 3);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "error", message: "Il browser non supporta la geolocalizzazione." });
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearbyCount = activities.filter(
          (a) => a.lat !== undefined && a.lng !== undefined && haversineKm(latitude, longitude, a.lat, a.lng) <= 5
        ).length;
        setGeo({ status: "done", lat: latitude, lng: longitude, nearbyCount });
        try {
          sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify({ lat: latitude, lng: longitude }));
        } catch {
          // storage non disponibile (es. modalità privata): non blocchiamo l'uso
        }
      },
      () => {
        setGeo({
          status: "error",
          message:
            "Posizione non disponibile: il browser non permette di richiederla di nuovo dopo un rifiuto. Vai nelle impostazioni del sito (icona vicino alla barra indirizzi) per riabilitarla.",
        });
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function openMap() {
    if (geo.status === "done") {
      router.push(`/search?lat=${geo.lat}&lng=${geo.lng}`);
    } else {
      locateMe();
    }
  }

  return (
    <>
      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">Categorie</span>
          <span
            onClick={() => setSelectedCategory(null)}
            className={`cursor-pointer text-[13px] font-medium ${
              selectedCategory === null ? "text-sky" : "text-ink-3"
            }`}
          >
            Tutte
          </span>
        </div>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              bg={cat.bg}
              selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory((prev) => (prev === cat.id ? null : cat.id))}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">
            {selectedCategory ? "🔥 Attività in questa categoria" : "🔥 Popolari vicino a te"}
          </span>
        </div>
        {popular.map((a) => (
          <ActivityCard key={a.id} activity={a} />
        ))}
        {popular.length === 0 && (
          <p className="mb-3 text-sm text-ink-2">Nessuna attività trovata in questa categoria.</p>
        )}

        {recommended.length > 0 && (
          <>
            <div className="mb-3 mt-1 flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">⭐ Consigliati per te</span>
            </div>
            {recommended.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </>
        )}
      </div>

      <div
        onClick={openMap}
        className="mx-5 mt-3.5 flex cursor-pointer items-center justify-between rounded-lg bg-sky-light px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <i className="ti ti-map text-[26px] text-sky" />
          <div>
            <p className="text-sm font-semibold text-ink">Attività sulla mappa</p>
            <p className="text-xs text-ink-2">
              {geo.status === "loading" && "Trovo la tua posizione…"}
              {geo.status === "idle" && "Attiva la posizione per vedere i centri vicini"}
              {geo.status === "done" &&
                `${geo.nearbyCount} centri nel raggio di 5 km dalla tua posizione`}
              {geo.status === "error" && geo.message}
            </p>
          </div>
        </div>
        <button className="rounded-sm bg-sky px-3.5 py-2 text-xs font-semibold text-white">
          {geo.status === "done" ? "Vedi in Cerca" : "Usa posizione"}
        </button>
      </div>
    </>
  );
}
