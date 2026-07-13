import Link from "next/link";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import OccupancyChart from "@/components/charts/OccupancyChart";
import { activities, bookingsMock, centers } from "@/lib/mock-data";
import { aggregateWeeklyOccupancy } from "@/lib/analytics";

export default function AdminDashboardPage() {
  const confirmedBookings = bookingsMock.filter((b) => b.status === "confirmed");
  const revenue = confirmedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const recent = [...bookingsMock].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);
  const occupancy = aggregateWeeklyOccupancy(activities.map((a) => a.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Dashboard piattaforma</h1>
        <p className="text-sm text-ink-2">Panoramica su tutti i centri e le attività di TRAMA</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Centri attivi" value={String(centers.length)} icon="ti-building-community" iconBg="#E8F6FD" iconColor="#4DAFEF" />
        <StatCard label="Attività pubblicate" value={String(activities.length)} icon="ti-list-details" iconBg="#E3F9F5" iconColor="#3ECFB2" />
        <StatCard label="Prenotazioni totali" value={String(bookingsMock.length)} icon="ti-ticket" iconBg="#FFF0EA" iconColor="#FF8C5A" />
        <StatCard label="Fatturato confermato" value={`€${revenue}`} icon="ti-coin-euro" iconBg="#F0EEFF" iconColor="#8B7CF8" />
      </div>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Occupazione settimanale — tutta la piattaforma</span>
          <Link href="/admin/analytics" className="text-xs font-medium text-sky">
            Analisi completa →
          </Link>
        </div>
        <OccupancyChart data={occupancy} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-[#E8EBF0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E8EBF0] px-4 py-3">
            <span className="text-sm font-bold text-ink">Prenotazioni recenti</span>
            <Link href="/admin/bookings" className="text-xs font-medium text-sky">
              Vedi tutte
            </Link>
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
              {recent.map((b) => {
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
            <span className="text-sm font-bold text-ink">Centri</span>
          </div>
          <div className="divide-y divide-[#F0F2F5]">
            {centers.map((c) => (
              <Link
                key={c.id}
                href={`/admin/centers/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg"
                  style={{ background: c.gradient }}
                >
                  {c.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{c.name}</div>
                  <div className="text-xs text-ink-2">{c.city}</div>
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
