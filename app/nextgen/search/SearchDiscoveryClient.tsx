"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Kid } from "@/lib/types";
import { computeSmartMatches } from "@/lib/nextgen/smart-search";
import { readStoredGeo, writeStoredGeo } from "@/lib/geo";
import ActivityCard from "@/components/ActivityCard";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// SPRINT 2 (NEXTGEN) — Ricerca e scoperta: pochi controlli manuali (nome,
// bambino, posizione), il resto del "filtro" è il contesto del genitore
// (età/interessi dei bambini, settimana ancora scoperta, vicinanza) tradotto
// in un ordinamento intelligente con motivazioni leggibili — non un elenco
// di 6 pannelli filtro come in LEGACY (età/prezzo/zona/tag/servizi/data).
// Scelta di scope: prezzo e servizi restano informazioni sulla card, non
// filtri manuali, per questo sprint.
type GeoStatus = "idle" | "loading" | "done" | "error";

export default function SearchDiscoveryClient({
  activities,
  kids,
  uncoveredWeekStart,
  uncoveredWeekLabel,
  availabilityByWeek,
}: {
  activities: Activity[];
  kids: Kid[];
  uncoveredWeekStart: string | null;
  uncoveredWeekLabel: string | null;
  availabilityByWeek: Record<string, string[]>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(() => readStoredGeo());
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoError("Il browser non supporta la geolocalizzazione.");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeo({ lat: latitude, lng: longitude });
        setGeoStatus("done");
        writeStoredGeo(latitude, longitude);
      },
      () => {
        setGeoStatus("error");
        setGeoError("Posizione non disponibile — puoi riabilitarla dalle impostazioni del sito.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const selectedKids = useMemo(
    () => (selectedKidId ? kids.filter((k) => k.id === selectedKidId) : kids),
    [kids, selectedKidId]
  );

  const matches = useMemo(() => {
    const all = computeSmartMatches(activities, selectedKids, {
      geo,
      uncoveredWeekStart,
      availabilityByWeek,
    });
    const q = query.trim().toLowerCase();
    return q ? all.filter((m) => m.activity.name.toLowerCase().includes(q)) : all;
  }, [activities, selectedKids, geo, uncoveredWeekStart, availabilityByWeek, query]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Scopri attività" onBack={() => router.push("/nextgen")} />
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
          className="mb-3 w-full rounded-xl border border-[#E8EBF0] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky"
        />

        {kids.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedKidId(null)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                selectedKidId === null ? "bg-ink text-white" : "bg-bg text-ink-2"
              }`}
            >
              Tutti i bambini
            </button>
            {kids.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setSelectedKidId(k.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  selectedKidId === k.id ? "bg-ink text-white" : "bg-bg text-ink-2"
                }`}
              >
                {k.name}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={locateMe}
          disabled={geoStatus === "loading"}
          className="mb-4 flex items-center gap-1.5 text-[12px] font-semibold text-sky disabled:opacity-60"
        >
          <i className="ti ti-map-pin text-[14px]" />
          {geo ? "Posizione attiva — aggiorna" : geoStatus === "loading" ? "Rilevamento…" : "Usa la mia posizione"}
        </button>
        {geoError && <p className="mb-3 text-[11px] text-orange">{geoError}</p>}

        {matches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Nessuna attività trovata.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {matches.map((m) => (
              <div key={m.activity.id}>
                {m.reasons.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1 px-1">
                    {m.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-sky-light px-2 py-0.5 text-[10px] font-semibold text-sky"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                <ActivityCard activity={m.activity} matchPercent={Math.min(99, Math.round(m.score))} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
