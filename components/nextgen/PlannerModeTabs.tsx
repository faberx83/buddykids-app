"use client";

import { useEffect, useRef, useState } from "react";

// SPRINT 5.1 (NEXTGEN) — "Il Planner dovrà offrire cinque modalità di
// visualizzazione degli stessi dati" (PRD di Fabrizio, Family Planner).
//
// SPRINT CORRETTIVO (feedback Fabrizio, mockup "2. Calendario"): "a questo
// punto anche Planner-Calendario finirebbero a collassare nella stessa
// sezione [Organizzazione]" — Organizzazione si è arricchita di una striscia
// "Stato per settimana" + copertura per bambino cliccabile, molto vicina a
// quello che offriva il tab Calendario a colpo d'occhio. Il tab "Calendario"
// come modalità separata sparisce da qui: il Mese/Settimana + "Chi fa
// cosa?" + "Condivisione piano" (PlannerCalendarView, invariato) restano
// TUTTI raggiungibili, ma ora da un riquadro pieghevole dentro
// Organizzazione (vedi PlannerClient.tsx) invece che da un tab a se stante —
// una vera modalità in meno da tenere a mente, zero funzionalità perse.
export type PlannerMode = "organizzazione" | "mappa" | "budget" | "gruppi";

export const PLANNER_MODES: { key: PlannerMode; label: string; icon: string }[] = [
  { key: "organizzazione", label: "Organizzazione", icon: "ti-layout-dashboard" },
  { key: "mappa", label: "Mappa", icon: "ti-map-pin" },
  { key: "budget", label: "Budget", icon: "ti-coin" },
  { key: "gruppi", label: "Gruppi", icon: "ti-users-group" },
];

// SPRINT CORRETTIVO (feedback Fabrizio): con 5 modalità la riga tab non ci
// sta mai su schermo intero — "Budget" restava sempre tagliato a metà e chi
// non sapeva che la riga scorre non lo scopriva mai. Aggiunta una sfumatura
// (fade) sui due bordi, visibile SOLO quando c'è davvero altro contenuto da
// quel lato (calcolato da scrollWidth/scrollLeft, aggiornato su scroll e
// resize) — non un'affordance statica, sparisce quando non serve più.
export default function PlannerModeTabs({
  mode,
  onChange,
}: {
  mode: PlannerMode;
  onChange: (mode: PlannerMode) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="relative -mx-5 mb-4">
      <div ref={scrollRef} className="no-scrollbar flex gap-2 overflow-x-auto px-5">
        {PLANNER_MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors active:scale-95 ${
              mode === m.key ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
            }`}
          >
            <i className={`ti ${m.icon} text-[14px]`} />
            {m.label}
          </button>
        ))}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-[#F7F9FC] to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#F7F9FC] to-transparent" />
      )}
    </div>
  );
}
