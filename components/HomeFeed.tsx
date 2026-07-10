"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlannerView from "@/components/PlannerView";
import PerBambinoView from "@/components/PerBambinoView";
import { Activity, Kid, Tag } from "@/lib/types";
import { PlannerData } from "@/lib/data/planner";
import { KidBookingEntry } from "@/lib/data/kid-bookings";
import { haversineKm } from "@/lib/geo";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; lat: number; lng: number; nearbyCount: number }
  | { status: "error"; message: string };

const GEO_STORAGE_KEY = "bk_last_geo";
const HOME_VIEW_KEY = "bk_home_view";

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

type HomeView = "planner" | "perBambino";

function readStoredView(): HomeView {
  if (typeof window === "undefined") return "planner";
  const stored = localStorage.getItem(HOME_VIEW_KEY);
  return stored === "perBambino" ? "perBambino" : "planner";
}

export default function HomeFeed({
  activities,
  categories,
  kids,
  planner,
  bookingsByKid,
  availabilityByWeek,
}: {
  activities: Activity[];
  categories: Tag[];
  kids: Kid[];
  planner: PlannerData;
  bookingsByKid: Record<string, KidBookingEntry[]>;
  // Per ciascuna delle 13 settimane stagionali, gli id delle attività con
  // posti liberi — passato al Planner per filtrare i suggerimenti "Per
  // riempire la settimana N" a chi ha davvero disponibilità.
  availabilityByWeek: Record<string, string[]>;
}) {
  const router = useRouter();
  const [view, setView] = useState<HomeView>(() => readStoredView());
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

  function selectView(next: HomeView) {
    setView(next);
    try {
      localStorage.setItem(HOME_VIEW_KEY, next);
    } catch {
      // storage non disponibile: la scelta vale solo per questa sessione
    }
  }

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
      <div className="px-5 pt-3.5">
        <div className="flex gap-2 rounded-[14px] bg-bg p-[5px]">
          <button
            onClick={() => selectView("planner")}
            className={`flex-1 rounded-[10px] py-2.5 text-[13px] transition-colors ${
              view === "planner"
                ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                : "font-medium text-ink-3"
            }`}
          >
            Planner
          </button>
          <button
            onClick={() => selectView("perBambino")}
            className={`flex-1 rounded-[10px] py-2.5 text-[13px] transition-colors ${
              view === "perBambino"
                ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                : "font-medium text-ink-3"
            }`}
          >
            Per bambino
          </button>
        </div>
      </div>

      {view === "planner" ? (
        <PlannerView
          planner={planner}
          activities={activities}
          availabilityByWeek={availabilityByWeek}
          kids={kids}
        />
      ) : (
        <PerBambinoView
          kids={kids}
          activities={activities}
          categories={categories}
          bookingsByKid={bookingsByKid}
        />
      )}

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
