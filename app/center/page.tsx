import Link from "next/link";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import OccupancyChart from "@/components/charts/OccupancyChart";
import {
  activities,
  bookingsMock,
  centers,
  demoCenterAdminCenterId,
  promotions,
} from "@/lib/mock-data";
import { aggregateWeeklyOccupancy } from "@/lib/analytics";

export default function CenterDashboardPage() {
  const center = centers.find((c) => c.id === demoCenterAdminCenterId)!;
  const myActivities = activities.filter((a) => a.centerId === center.id);
  const myBookings = bookingsMock.filter((b) =>
    myActivities.some((a) => a.id === b.activityId)
  );
  const myPromotions = promotions.filter((p) =>
    myActivities.some((a) => a.id === p.activityId) && p.active
  );
  const revenue = myBookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.totalAmount, 0);
  const occupancy = aggregateWeeklyOccupancy(myActivities.map((a) => a.id));
  const weakWeeks = occupancy.filter((w) => w.occupancyPercent < 40);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: center.gradient }}
        >
          {center.emoji}
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Ciao, {center.ownerName.split(" ")[0]} 👋</h1>
          <p className="text-sm text-ink-2">Ecco come sta andando {center.name}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Attività" value={String(myActivities.length)} icon="ti-list-details" iconBg="#E8F6FD" iconColor="#4DAFEF" />
        <StatCard label="Prenotazioni" value={String(myBookings.length)} icon="ti-ticket" iconBg="#E3F9F5" iconColor="#3ECFB2" />
        <StatCard label="Promozioni attive" value={String(myPromotions.length)} icon="ti-discount-2" iconBg="#F0EEFF" iconColor="#8B7CF8" />
        <StatCard label="Fatturato confermato" value={`€${revenue}`} icon="ti-coin-euro" iconBg="#FFF0EA" iconColor="#FF8C5A" />
      </div>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Occupazione settimanale (tutte le attività)</span>
          {weakWeeks.length > 0 && (
            <Link
              href="/center/promotions"
              className="flex items-center gap-1 rounded-full bg-orange-light px-2.5 py-1 text-[11px] font-semibold text-[#d4622a]"
            >
              <i className="ti ti-bolt text-xs" />
              {weakWeeks.length} settiman{weakWeeks.length === 1 ? "a" : "e"} sotto il 40% — valuta un last-minute
            </Link>
          )}
        </div>
        <p className="mb-2 text-xs text-ink-2">
          Usa questo grafico per capire dove i posti restano vuoti e decidere su quali settimane
          spingere una promo last-minute.
        </p>
        <OccupancyChart data={occupancy} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-[#E8EBF0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E8EBF0] px-4 py-3">
            <span className="text-sm font-bold text-ink">Prenotazioni recenti</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">Bambino</th>
                <th className="px-4 py-2 font-medium">Attività</th>
                <th className="px-4 py-2 font-medium">Totale</th>
                <th className="px-4 py-2 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {myBookings.map((b) => {
                const activity = activities.find((a) => a.id === b.activityId);
                return (
                  <tr key={b.id} className="border-t border-[#F0F2F5]">
                    <td className="px-4 py-2.5 font-medium text-ink">{b.kidName}</td>
                    <td className="px-4 py-2.5 text-ink-2">{activity?.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">€{b.totalAmount}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3">
            <span className="text-sm font-bold text-ink">Le tue attività</span>
          </div>
          <div className="divide-y divide-[#F0F2F5]">
            {myActivities.map((a) => (
              <Link
                key={a.id}
                href={`/center/activities/${a.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg"
              >
                <span className="text-xl">{a.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{a.name}</div>
                  <div className="text-xs text-ink-2">
                    {a.spotsLeft !== undefined ? `${a.spotsLeft} posti rimasti` : "Disponibile"}
                  </div>
                </div>
                <i className="ti ti-chevron-right text-ink-3" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
