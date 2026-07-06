import { notFound } from "next/navigation";
import { activities, activityDaysByActivity, bookingsMock } from "@/lib/mock-data";
import PhoneShell from "@/components/PhoneShell";
import PageHeader from "@/components/PageHeader";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

export function generateStaticParams() {
  return activities.map((a) => ({ activityId: a.id }));
}

export default async function ParentCenterCalendarPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) return notFound();

  const days = activityDaysByActivity[activity.id] ?? [];
  const enrollment = bookingsMock.find(
    (b) => b.activityId === activity.id && b.parentName === "Sofia Ferretti"
  );

  // Nella demo evidenziamo la prima settimana come i giorni frequentati dal bambino
  const highlightDates = days.slice(0, 5).map((d) => d.date);

  return (
    <PhoneShell>
      <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
        <PageHeader title={activity.name} backHref="/calendar" />

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#F0F2F5] bg-white p-3.5">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl"
              style={{ background: activity.imgGradient }}
            >
              {activity.emoji}
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{activity.center}</div>
              <div className="text-xs text-ink-2">
                {enrollment ? `${enrollment.kidName} iscritto/a` : "Nessuna iscrizione attiva"}
              </div>
            </div>
          </div>

          <p className="mb-4 text-xs text-ink-2">
            I giorni evidenziati con il bordo azzurro sono quelli frequentati dal tuo bambino.
            Gli altri mostrano la disponibilità generale del centro — utile per capire se ci
            sono ancora posti o promozioni su altri giorni.
          </p>

          <AvailabilityCalendar days={days} mode="view" highlightDates={highlightDates} />
        </div>
      </div>
    </PhoneShell>
  );
}
