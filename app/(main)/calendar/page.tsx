"use client";

import { useState } from "react";
import Link from "next/link";
import CalendarGrid from "@/components/CalendarGrid";
import EventCard from "@/components/EventCard";
import {
  activities,
  bookedDays,
  bookingsMock,
  calendarEvents,
  eventDays,
  today,
} from "@/lib/mock-data";

const cells = [
  ...[27, 28, 29, 30, 31].map((d) => ({ day: d, otherMonth: true })),
  ...Array.from({ length: 30 }, (_, i) => ({ day: i + 1 })),
];

const tabs = ["I miei impegni", "Calendari centri"];

// Attività dei bambini di Sofia (demo) — in un'app reale filtrate per parent_id
const myEnrollments = bookingsMock.filter(
  (b) => b.parentName === "Sofia Ferretti" && b.status !== "cancelled"
);

export default function CalendarPage() {
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
            {calendarEvents.map((e) => (
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
          {myEnrollments.map((b) => {
            const activity = activities.find((a) => a.id === b.activityId);
            if (!activity) return null;
            return (
              <Link
                key={b.id}
                href={`/calendar-center/${activity.id}`}
                className="mb-2.5 flex items-center gap-3 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-transform hover:scale-[0.98]"
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ background: activity.imgGradient }}
                >
                  {activity.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{activity.name}</div>
                  <div className="text-xs text-ink-2">
                    {b.kidName} · {activity.center}
                  </div>
                </div>
                <i className="ti ti-chevron-right text-ink-3" />
              </Link>
            );
          })}
          {myEnrollments.length === 0 && (
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
