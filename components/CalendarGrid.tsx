"use client";

const dayHeaders = ["L", "M", "M", "G", "V", "S", "D"];

interface Cell {
  day: number;
  otherMonth?: boolean;
}

export default function CalendarGrid({
  cells,
  today,
  eventDays,
  bookedDays,
}: {
  cells: Cell[];
  today: number;
  eventDays: number[];
  bookedDays: number[];
}) {
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {dayHeaders.map((h, i) => (
        <div key={i} className="pb-1 pt-1 text-center text-[11px] font-semibold text-ink-3">
          {h}
        </div>
      ))}
      {cells.map((cell, i) => {
        const isToday = !cell.otherMonth && cell.day === today;
        const hasEvent = !cell.otherMonth && eventDays.includes(cell.day);
        const isBooked = !cell.otherMonth && bookedDays.includes(cell.day);

        return (
          <div
            key={i}
            className={`relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-sky-light ${
              cell.otherMonth
                ? "text-ink-3 opacity-35"
                : isToday
                ? "bg-sky font-bold text-white"
                : isBooked
                ? "bg-sky-light font-semibold text-sky"
                : "text-ink-2"
            }`}
          >
            {cell.day}
            {hasEvent && (
              <span
                className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                  isToday ? "bg-white" : "bg-orange"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
