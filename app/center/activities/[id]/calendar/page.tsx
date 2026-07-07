import { notFound } from "next/navigation";
import Link from "next/link";
import { activities, activityDaysByActivity, defaultWeeks, weeksByActivity } from "@/lib/mock-data";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import OccupancyChart from "@/components/charts/OccupancyChart";
import { weeklyOccupancy } from "@/lib/analytics";

export function generateStaticParams() {
  return activities.map((a) => ({ id: a.id }));
}

export default async function CenterActivityCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) return notFound();

  const days = activityDaysByActivity[activity.id] ?? [];
  const weeksCount = (weeksByActivity[activity.id] ?? defaultWeeks).length;
  const occupancy = weeklyOccupancy(activity.id);
  const weakWeeks = occupancy.filter((w) => w.occupancyPercent < 40);

  return (
    <div>
      <Link
        href={`/center/activities/${activity.id}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky"
      >
        <i className="ti ti-arrow-left" /> {activity.name}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Calendario disponibilità</h1>
        <p className="text-sm text-ink-2">
          Apri o chiudi singoli giorni, aggiorna i posti e imposta sconti mirati o promo
          last-minute — {weeksCount} settimane pubblicate.
        </p>
      </div>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Occupazione per settimana</span>
          {weakWeeks.length > 0 && (
            <Link
              href="/center/promotions"
              className="flex items-center gap-1 rounded-full bg-orange-light px-2.5 py-1 text-[11px] font-semibold text-[#d4622a]"
            >
              <i className="ti ti-bolt text-xs" />
              Suggerisci promo last-minute
            </Link>
          )}
        </div>
        <OccupancyChart data={occupancy} />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
        <AvailabilityCalendar days={days} mode="edit" />
      </div>
    </div>
  );
}
