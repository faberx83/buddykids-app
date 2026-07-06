import { CalendarEvent } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="mb-2.5 flex cursor-pointer gap-3 rounded-md border border-[#F0F2F5] bg-white p-3 transition-transform hover:scale-[0.98]">
      <div
        className="min-w-[46px] flex-shrink-0 rounded-sm px-2.5 py-2 text-center"
        style={{ background: event.blockColor }}
      >
        <div className="text-lg font-bold" style={{ color: event.textColor }}>
          {event.day}
        </div>
        <div className="text-[10px] font-bold uppercase" style={{ color: event.textColor }}>
          {event.month}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[13px] font-semibold text-ink">{event.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <i className="ti ti-clock" />
          {event.meta}
        </div>
        {event.meta2 && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-2">
            <i className="ti ti-user" />
            {event.meta2}
          </div>
        )}
      </div>
      <div className="ml-auto flex self-start">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pillClasses[event.pillColor]}`}
        >
          {event.pillLabel}
        </span>
      </div>
    </div>
  );
}
