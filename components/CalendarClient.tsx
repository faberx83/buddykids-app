"use client";

import { useState } from "react";
import Link from "next/link";
import CalendarGrid from "@/components/CalendarGrid";
import EventCard from "@/components/EventCard";
import { CalendarEvent } from "@/lib/types";
import { CenterEnrollment } from "@/lib/data/calendar";

const cells = [
  ...[27, 28, 29, 30, 31].map((d) => ({ day: d, otherMonth: true })),
  ...Array.from({ length: 30 }, (_, i) => ({ day: i + 1 })),
];

const tabs = ["I miei impegni", "Calendari centri"];

export default function CalendarClient({
  events,
  enrollments,
  today,
  bookedDays,
  eventDays,
}: {
  events: CalendarEvent[];
  enrollments: CenterEnrollment[];
  today: number;
  bookedDays: number[];
  eventDays: number[];
}) {
  const [tab, setTab] = useState(0);

  return (
    <div className="animate-fade-in">
      <div className="flex-shrink-0 border-b border-[#F0F2F5] bg-white px-5 pb-3 pt-3.5">
        <h2 className="mb-3.5 text-lg font-bold text-ink">Il mio Calendario</h2>
        <div className="flex rounded-lg bg-[#F4F6FA] p-[3px]">
          {tabs.map((t, i) => (
            <div
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 cursor-pointer rounded-md py-2 text-center text-xs font-medium transition-all ${
                tab === i
                  ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                  : "text-ink-2"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {tab === 0 && (
        <>
          <div className="flex-shrink-0 border-b border-[#F0F2F5] bg-white px-5 pb-4 pt-3.5">
            <div className="mb-3.5 flex items-center justify-between">
              <button className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-[#E8EBF0] text-lg text-ink-2 transition-colors hover:border-sky hover:bg-sky-light">
                <i className="ti ti-chevron-left" />
              </button>
              <span className="text-[15px] font-bold text-ink">Giugno 2025</span>
              <button className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-[#E8EBF0] text-lg text-ink-2 transition-colors hover:border-sky hover:bg-sky-light">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
            <CalendarGrid cells={cells} today={today} eventDays={eventDays} bookedDays={bookedDays} />
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 text-sm font-bold text-ink">Prossimi appuntamenti</div>
            {events.length === 0 && (
              <p className="text-sm text-ink-2">
                Nessun appuntamento — prenota un&apos;attività per vederla qui.
              </p>
            )}
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </>
      )}

      {tab === 1 && (
        <div className="px-5 py-4">
          <div className="mb-3 text-sm font-bold text-ink">Calendario dei centri</div>
          <p className="mb-4 text-xs text-ink-2">
            Il calendario giorno-per-giorno delle attività a cui sono iscritti i tuoi bambini:
            giorni aperti, pieni o con promo.
          </p>
          {enrollments.map((b) => (
            <Link
              key={b.bookingId}
              href={`/calendar-center/${b.activitySlug}`}
              className="mb-2.5 flex items-center gap-3 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-transform hover:scale-[0.98]"
            >
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl"
                style={{ background: b.activityGradient }}
              >
                {b.activityEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{b.activityName}</div>
                <div className="text-xs text-ink-2">
                  {b.kidNames} · {b.centerName}
                </div>
              </div>
              <i className="ti ti-chevron-right text-ink-3" />
            </Link>
          ))}
          {enrollments.length === 0 && (
            <p className="text-sm text-ink-2">
              Nessuna attività attiva al momento — prenota un&apos;attività per vederne qui il
              calendario.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
