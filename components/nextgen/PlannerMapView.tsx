"use client";

import dynamic from "next/dynamic";
// "import type": PlannerMapPin è un'interfaccia (usata solo come tipo) da un
// modulo che importa lib/supabase/server — con "import type" il compilatore
// la elimina sempre dal bundle client, evitando lo stesso bug di build già
// risolto per ADDRESS_KIND_LABELS/RESPONSIBLE_OPTIONS (vedi
// lib/nextgen/address-kinds.ts).
import type { PlannerMapPin } from "@/lib/data/planner-map";
import { estimateDistance } from "@/lib/nextgen/planner-map-estimate";
import Link from "next/link";

// SPRINT 5.4 (NEXTGEN) — Planner, modalità Mappa: "tutte le attività su una
// mappa, con distanze e tempi di percorrenza dai tuoi indirizzi salvati"
// (PRD Family Planner). Riusa components/ActivityMap.tsx TALE E QUALE (già
// usato da LEGACY Cerca, stile "light" CartoDB, nessuna API a pagamento) —
// nessun componente mappa nuovo, solo un nuovo punto di ingresso con i pin
// delle attività prenotate invece che dei risultati di ricerca. Leaflet usa
// `window`, quindi va caricato solo lato client (stesso pattern di
// SearchClient.tsx).
const ActivityMap = dynamic(() => import("@/components/ActivityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-[#E8EBF0] bg-bg text-sm text-ink-2">
      Carico la mappa…
    </div>
  ),
});

export default function PlannerMapView({ pins }: { pins: PlannerMapPin[] }) {
  if (pins.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
        <i className="ti ti-map-pin mb-2 text-2xl text-ink-3" />
        <p className="text-xs text-ink-2">
          Prenota un&apos;attività per vederla qui sulla mappa, con distanze e tempi di percorrenza dai tuoi indirizzi.
        </p>
      </div>
    );
  }

  const mappable = pins.filter((p) => p.lat !== null && p.lng !== null);

  return (
    <div className="flex flex-col gap-3">
      {mappable.length > 0 ? (
        <ActivityMap
          items={mappable.map((p) => ({ id: p.activityDbId, name: p.activityName, emoji: p.emoji, lat: p.lat!, lng: p.lng! }))}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
          <p className="text-xs text-ink-2">Nessuna delle tue attività ha un indirizzo con coordinate da mostrare in mappa.</p>
        </div>
      )}

      {/* SPRINT 5.4 — distanza/tempo di percorrenza: dato STUBBATO ma
          VISIBILE (scelta esplicita di Fabrizio), perché gli indirizzi di
          famiglia (Sprint 5.3) sono testo libero senza coordinate — vedi
          lib/nextgen/planner-map-estimate.ts. Sempre etichettato "stimato". */}
      <div className="rounded-2xl bg-white p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-[13px] font-bold text-ink">Le tue attività</div>
          <span className="text-[10px] font-semibold text-ink-3">distanza stimata</span>
        </div>
        <div className="flex flex-col gap-2">
          {pins.map((p) => {
            const hasCoords = p.lat !== null && p.lng !== null;
            const estimate = hasCoords ? estimateDistance(p.activityDbId) : null;
            return (
              <Link
                key={p.activityDbId}
                href={`/activity/${p.activitySlug}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-ink">
                    {p.emoji} {p.activityName}
                  </div>
                  {p.kidNames.length > 0 && (
                    <div className="truncate text-[10.5px] text-ink-3">{p.kidNames.join(", ")}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right text-[10.5px] font-semibold text-ink-2">
                  {estimate ? `~${estimate.km} km · ${estimate.minutes} min` : "Indirizzo non disponibile"}
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-2.5 text-[10.5px] text-ink-3">
          Le distanze sono una stima: il calcolo reale dai tuoi indirizzi di famiglia arriverà in un prossimo
          aggiornamento.
        </p>
      </div>
    </div>
  );
}
