"use client";

// SPRINT 5.1 (NEXTGEN) — "Il Planner dovrà offrire cinque modalità di
// visualizzazione degli stessi dati" (PRD di Fabrizio, Family Planner).
// Tutte e 5 le modalità sono ora funzionanti (Calendario 5.2, Mappa 5.4,
// Gruppi 5.6).
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
