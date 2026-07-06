"use client";

import { useState } from "react";
import ActivityCardHorizontal from "@/components/ActivityCardHorizontal";
import { activities } from "@/lib/mock-data";

const filters = [
  { icon: "ti-adjustments-horizontal", label: "Filtri" },
  { icon: "ti-map-pin", label: "Zona" },
  { icon: "ti-users", label: "Età" },
  { icon: "ti-coin-euro", label: "Prezzo" },
  { icon: "ti-calendar", label: "Date" },
];

export default function SearchPage() {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");

  const results = activities.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex-shrink-0 bg-white px-5 pb-3.5 pt-3">
        <div className="relative">
          <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] py-[11px] pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-sky"
            placeholder="Cerca attività, centri, sport..."
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pt-2.5">
          {filters.map((f, i) => (
            <div
              key={f.label}
              onClick={() => setActive(i)}
              className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-medium transition-colors ${
                active === i
                  ? "border-sky bg-sky text-white"
                  : "border-[#E8EBF0] bg-[#F4F6FA] text-ink-2 hover:border-sky hover:bg-sky hover:text-white"
              }`}
            >
              <i className={`ti ${f.icon} text-[13px]`} />
              {f.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <span className="text-[13px] text-ink-2">{results.length} attività trovate</span>
        <div className="flex cursor-pointer items-center gap-1 text-xs font-medium text-sky">
          <i className="ti ti-arrows-sort text-sm" />
          Ordina
        </div>
      </div>

      {results.map((a) => (
        <ActivityCardHorizontal key={a.id} activity={a} />
      ))}
      <div className="h-5" />
    </div>
  );
}
