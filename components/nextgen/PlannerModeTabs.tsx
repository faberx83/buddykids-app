"use client";

// SPRINT 5.1 (NEXTGEN) — "Il Planner dovrà offrire cinque modalità di
// visualizzazione degli stessi dati" (PRD di Fabrizio, Family Planner). Solo
// Organizzazione e Budget sono funzionanti in questa fase (5.1); Calendario,
// Mappa e Gruppi mostrano uno stato "Presto disponibile" — arrivano nelle
// fasi 5.2/5.4/5.6, ma il selettore è già a 5 voci per non dover rifare
// questo componente ogni volta.
export type PlannerMode = "organizzazione" | "calendario" | "mappa" | "budget" | "gruppi";

export const PLANNER_MODES: { key: PlannerMode; label: string; icon: string }[] = [
  { key: "organizzazione", label: "Organizzazione", icon: "ti-layout-dashboard" },
  { key: "calendario", label: "Calendario", icon: "ti-calendar" },
  { key: "mappa", label: "Mappa", icon: "ti-map-pin" },
  { key: "budget", label: "Budget", icon: "ti-coin" },
  { key: "gruppi", label: "Gruppi", icon: "ti-users-group" },
];

export default function PlannerModeTabs({
  mode,
  onChange,
}: {
  mode: PlannerMode;
  onChange: (mode: PlannerMode) => void;
}) {
  return (
    <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
      {PLANNER_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors ${
            mode === m.key ? "bg-[#5B4FE9] text-white" : "bg-bg text-ink-2"
          }`}
        >
          <i className={`ti ${m.icon} text-[14px]`} />
          {m.label}
        </button>
      ))}
    </div>
  );
}
