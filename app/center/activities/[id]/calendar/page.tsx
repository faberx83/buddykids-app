import { notFound } from "next/navigation";
import Link from "next/link";
import { activities, activityDaysByActivity, defaultWeeks, weeksByActivity } from "@/lib/mock-data";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

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

      <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
        <AvailabilityCalendar days={days} mode="edit" />
      </div>
    </div>
  );
}
