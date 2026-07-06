"use client";

import { Week } from "@/lib/types";

export default function WeekCard({
  week,
  selected,
  onToggle,
}: {
  week: Week;
  selected: boolean;
  onToggle: () => void;
}) {
  if (week.soldOut) {
    return (
      <div className="cursor-not-allowed rounded-md border-[1.5px] border-[#E8EBF0] bg-[#FAFBFD] p-3 opacity-50">
        <div className="mb-0.5 text-[10px] font-semibold uppercase text-ink-3">
          {week.label}
        </div>
        <div className="text-[13px] font-semibold text-ink">{week.dates}</div>
        <div className="mt-1 text-[11px] font-medium text-orange">✗ Sold out</div>
      </div>
    );
  }

  return (
    <div
      onClick={onToggle}
      className={`cursor-pointer rounded-md border-[1.5px] p-3 transition-colors ${
        selected ? "border-sky bg-sky-light" : "border-[#E8EBF0] bg-white hover:border-sky hover:bg-sky-light"
      }`}
    >
      <div className="mb-0.5 text-[10px] font-semibold uppercase text-ink-3">
        {week.label}
      </div>
      <div className="text-[13px] font-semibold text-ink">{week.dates}</div>
      <div className="mt-1 text-[11px] font-medium text-green">
        ✓ {week.spots} posti
      </div>
    </div>
  );
}
