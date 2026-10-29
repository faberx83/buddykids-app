import { notFound } from "next/navigation";
import Link from "next/link";
import { defaultWeeks, weeksByActivity } from "@/lib/mock-data";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import OccupancyChart from "@/components/charts/OccupancyChart";
import { weeklyOccupancyFromDays } from "@/lib/analytics";
import { getActivityBySlug } from "@/lib/data/activities";
import { getActivityDays } from "@/lib/data/activity-days";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

export default async function CenterActivityCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();

  const days = await getActivityDays(activity);
  const weeksCount = (weeksByActivity[activity.id] ?? defaultWeeks).length;
  const occupancy = weeklyOccupancyFromDays(days);
  const weakWeeks = occupancy.filter((w) => w.occupancyPercent < 40);

  // Portale centri V2 (29/10/2026): stesso calendario, titolo e riquadri come
  // le altre sezioni ("Date e posti", raggiunto dalla scheda attività).
  if (await partnerShellEnabledForCurrentUser()) {
    return (
      <div className="flex flex-col gap-5">
        <Link
          href={`/center/activities/${activity.id}`}
          className="inline-flex min-h-[40px] items-center gap-1 self-start text-[14px] font-semibold text-partner-primary"
        >
          <i className="ti ti-chevron-left text-[18px]" aria-hidden="true" /> {activity.name}
        </Link>
        <PartnerPageHeader
          title="Date e posti"
          subtitle={`Aprite o chiudete i giorni, aggiornate i posti e gli sconti. ${weeksCount} ${weeksCount === 1 ? "settimana pubblicata" : "settimane pubblicate"}.`}
        />
        <section aria-labelledby="cal-occupazione" className="rounded-[18px] border border-partner-line bg-white p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 id="cal-occupazione" className="font-poppins text-[17px] font-semibold text-ink">
              Posti occupati per settimana
            </h2>
            {weakWeeks.length > 0 && (
              <Link
                href="/center/promotions"
                className="flex min-h-[36px] items-center gap-1 rounded-full bg-[#FBF1DA] px-3 text-[12.5px] font-semibold text-partner-accent-ink"
              >
                <i className="ti ti-bolt text-[14px]" aria-hidden="true" />
                Proponi uno sconto last-minute
              </Link>
            )}
          </div>
          <OccupancyChart data={occupancy} />
        </section>
        <section className="rounded-[18px] border border-partner-line bg-white p-4" data-spotlight="configure_spot_days">
          <AvailabilityCalendar days={days} mode="edit" activityDbId={activity.dbId} />
        </section>
      </div>
    );
  }

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
              className="flex items-center gap-1 rounded-full bg-orange-light px-2.5 py-1 text-[11px] font-semibold text-trama-orange"
            >
              <i className="ti ti-bolt text-xs" />
              Suggerisci promo last-minute
            </Link>
          )}
        </div>
        <OccupancyChart data={occupancy} />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white p-4" data-spotlight="configure_spot_days">
        <AvailabilityCalendar days={days} mode="edit" activityDbId={activity.dbId} />
      </div>
    </div>
  );
}
