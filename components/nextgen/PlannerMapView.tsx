"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
// "import type": PlannerMapPin è un'interfaccia (usata solo come tipo) da un
// modulo che importa lib/supabase/server — con "import type" il compilatore
// la elimina sempre dal bundle client, evitando lo stesso bug di build già
// risolto per ADDRESS_KIND_LABELS/RESPONSIBLE_OPTIONS (vedi
// lib/nextgen/address-kinds.ts).
import type { PlannerMapPin } from "@/lib/data/planner-map";
import { estimateDistance } from "@/lib/nextgen/planner-map-estimate";
import Link from "next/link";
import { ADDRESS_KIND_LABELS, ParentAddress } from "@/lib/nextgen/address-kinds";

// SPRINT 5.4 (NEXTGEN) — Planner, modalità Mappa: "tutte le attività su una
// mappa, con distanze e tempi di percorrenza dai tuoi indirizzi salvati"
// (PRD Family Planner). Riusa components/ActivityMap.tsx TALE E QUALE (già
// usato da LEGACY Cerca, stile "light" CartoDB, nessuna API a pagamento) —
// nessun componente mappa nuovo, solo un nuovo punto di ingresso con i pin
// delle attività prenotate invece che dei risultati di ricerca. Leaflet usa
// `window`, quindi va caricato solo lato client (stesso pattern di
// SearchClient.tsx).
//
// SPRINT CORRETTIVO (feedback Fabrizio, mockup "3. Mappa"): "ci vuole una
// mappa più piccola e semplice" — altezza ridotta da 440 a 200px (prop
// opt-in `height` su ActivityMap, LEGACY Cerca non tocca). "Il PIN una volta
// cliccato deve essere evidenziato e deve mostrare sotto una scheda
// sintetica con l'Avvia Navigazione" — click su un pin (o su una riga della
// lista, stessa selezione) mostra la scheda sotto la mappa invece del popup
// Leaflet. "Se non c'è selezione, lista dei campi sotto la mappa" — stato di
// default, invariato nella sostanza (era già una lista), ora con CTA
// "Apri scheda"/"Avvia navigazione" raggiunte cliccando la riga.
const ActivityMap = dynamic(() => import("@/components/ActivityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] w-full items-center justify-center rounded-2xl border border-[#E8EBF0] bg-bg text-sm text-ink-2">
      Carico la mappa…
    </div>
  ),
});

// SPRINT 4 correttivo (feedback Fabrizio, mockup "3. Mappa": "va bene metter
// origine uno degli indirizzi, ma lasciare scelta all'utente") — se è
// selezionato un indirizzo di partenza, "Avvia navigazione" costruisce un
// link di ITINERARIO (origin+destination) invece di una semplice ricerca
// della destinazione (che lasciava a Google Maps l'uso della posizione GPS
// del device, non necessariamente quella di famiglia scelta).
function mapsUrl(address: string, origin?: string | null): string {
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(address)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function PlannerMapView({ pins, addresses }: { pins: PlannerMapPin[]; addresses: ParentAddress[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stesso principio già applicato in Promemoria (PromemoriaClient.tsx):
  // solo gli indirizzi compilati sono selezionabili, default "casa" se
  // presente altrimenti il primo compilato, nessuna selezione forzata se la
  // famiglia non ha ancora salvato nulla.
  const availableAddresses = addresses.filter((a) => a.address.trim() !== "");
  const [originKind, setOriginKind] = useState<string | null>(() => {
    const casa = availableAddresses.find((a) => a.kind === "casa");
    return casa?.kind ?? availableAddresses[0]?.kind ?? null;
  });
  const selectedOrigin = availableAddresses.find((a) => a.kind === originKind) ?? null;
  const originLabel = (a: ParentAddress) => a.label || ADDRESS_KIND_LABELS[a.kind];

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
  const selected = pins.find((p) => p.activityDbId === selectedId) ?? null;
  const selectedEstimate = selected && selected.lat !== null ? estimateDistance(selected.activityDbId) : null;

  return (
    <div className="flex flex-col gap-3">
      {mappable.length > 0 ? (
        <ActivityMap
          items={mappable.map((p) => ({ id: p.activityDbId, name: p.activityName, emoji: p.emoji, lat: p.lat!, lng: p.lng! }))}
          height={200}
          selectedId={selectedId ?? undefined}
          onSelect={setSelectedId}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
          <p className="text-xs text-ink-2">Nessuna delle tue attività ha un indirizzo con coordinate da mostrare in mappa.</p>
        </div>
      )}

      {selected ? (
        /* SPRINT CORRETTIVO — scheda sintetica del pin selezionato: nome,
           indirizzo, distanza stimata, "Apri scheda" + "Avvia navigazione".
           "✕" per tornare alla lista di tutte le attività. */
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-ink">
                {selected.emoji} {selected.activityName}
              </div>
              {selected.address && <div className="mt-0.5 truncate text-[12px] text-ink-2">{selected.address}</div>}
              {selected.kidNames.length > 0 && (
                <div className="mt-0.5 truncate text-[11px] text-ink-3">{selected.kidNames.join(", ")}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Chiudi scheda"
              className="flex-shrink-0 text-ink-3"
            >
              <i className="ti ti-x text-[18px]" />
            </button>
          </div>
          {selectedEstimate && (
            <div className="mb-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2">
              <i className="ti ti-walk text-[14px]" />
              ~{selectedEstimate.km} km · {selectedEstimate.minutes} min
              <span className="text-[10px] font-normal text-ink-3">(stimato)</span>
            </div>
          )}
          {/* SPRINT 4 correttivo — selettore "Parti da": stesso pattern pill
              già usato in Promemoria, qui applicato all'itinerario che
              "Avvia navigazione" apre in Maps. Compare solo se c'è almeno un
              indirizzo salvato; senza indirizzi il comportamento resta
              quello di prima (solo destinazione). */}
          {availableAddresses.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10.5px] font-semibold text-ink-3">Parti da</div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {availableAddresses.map((a) => (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => setOriginKind(a.kind)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      originKind === a.kind ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {originLabel(a)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Link
              href={`/activity/${selected.activitySlug}`}
              className="flex-1 rounded-full bg-bg py-2.5 text-center text-[12.5px] font-bold text-ink-2"
            >
              Apri scheda
            </Link>
            {selected.address && (
              <a
                href={mapsUrl(selected.address, selectedOrigin?.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-full bg-trama-violet py-2.5 text-center text-[12.5px] font-bold text-white"
              >
                Avvia navigazione
              </a>
            )}
          </div>
        </div>
      ) : (
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
                <button
                  key={p.activityDbId}
                  type="button"
                  onClick={() => hasCoords && setSelectedId(p.activityDbId)}
                  disabled={!hasCoords}
                  className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5 text-left disabled:opacity-60"
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
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[10.5px] text-ink-3">
            Le distanze sono una stima: il calcolo reale dai tuoi indirizzi di famiglia arriverà in un prossimo
            aggiornamento.
          </p>
        </div>
      )}
    </div>
  );
}
