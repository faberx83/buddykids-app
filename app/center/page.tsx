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
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { buildActivityFeed } from "@/lib/activity-feed";

export default async function CenterDashboardPage() {
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

  // Richieste gruppo: dato reale (da Supabase quando collegato), a
  // differenza del resto di questa pagina che è ancora mock (task noto,
  // separato da questo redesign — vedi backlog "Dashboard Gestore ancora
  // 100% mock").
  const groupRequests = await getGroupRequestsForCenter();
  const pendingGroupRequests = groupRequests.filter((r) => r.status === "pending");

  const feed = buildActivityFeed({
    weakWeeks,
    groupRequests,
    bookings: myBookings,
    promotions: myPromotions,
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">{center.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Bentornato, {center.ownerName.split(" ")[0]}
          </p>
        </div>
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl"
          style={{ background: center.gradient }}
        >
          {center.emoji}
        </div>
      </div>

      {/* Banner "cose da guardare oggi" — solo le condizioni davvero attive,
          niente placeholder vuoti. Le decisioni da prendere vengono prima dei
          KPI, non dopo. */}
      {(weakWeeks.length > 0 || pendingGroupRequests.length > 0) && (
        <div className="mb-4 flex flex-col gap-2">
          {weakWeeks.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-orange-light p-3.5">
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-orange-mid">
                <i className="ti ti-bolt text-base text-[#d4622a]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {weakWeeks.length} settiman{weakWeeks.length === 1 ? "a" : "e"} sotto il 40% di
                  occupazione
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#8a5a33]">
                  Valuta uno sconto last-minute
                </div>
              </div>
              <Link
                href="/center/promotions"
                className="flex-shrink-0 whitespace-nowrap rounded-lg bg-[#d4622a] px-3.5 py-2 text-[11.5px] font-bold text-white"
              >
                Crea promo
              </Link>
            </div>
          )}
          {pendingGroupRequests.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-partner-light p-3.5">
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-partner-mid">
                <i className="ti ti-users-group text-base text-partner" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {pendingGroupRequests.length} richiest{pendingGroupRequests.length === 1 ? "a" : "e"}{" "}
                  gruppo in attesa
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-partner">
                  Sconto gruppo · {pendingGroupRequests[0].activityName}
                </div>
              </div>
              <Link
                href="/center/group-requests"
                className="flex-shrink-0 whitespace-nowrap rounded-lg bg-partner px-3.5 py-2 text-[11.5px] font-bold text-white"
              >
                Rivedi
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Attività"
          value={String(myActivities.length)}
          icon="ti-list-details"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          elevated
        />
        <StatCard
          label="Prenotazioni"
          value={String(myBookings.length)}
          icon="ti-ticket"
          iconBg="#E3F9F5"
          iconColor="#3ECFB2"
          elevated
        />
        <StatCard
          label="Promo attive"
          value={String(myPromotions.length)}
          icon="ti-discount-2"
          iconBg="#F0EEFF"
          iconColor="#8B7CF8"
          elevated
        />
        <StatCard
          label="Fatturato confermato"
          value={`€${revenue}`}
          icon="ti-coin-euro"
          iconBg="#FFF0EA"
          iconColor="#FF8C5A"
          elevated
        />
      </div>

      <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="text-sm font-bold text-ink">Occupazione settimanale</span>
        <p className="mb-2 mt-1 text-xs text-ink-2">
          Usa questo grafico per capire dove i posti restano vuoti e decidere su quali settimane
          spingere una promo last-minute.
        </p>
        <OccupancyChart data={occupancy} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#F0F2F5] px-4 py-3.5">
            <span className="text-[13.5px] font-bold text-ink">Prenotazioni recenti</span>
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
                  <tr key={b.id} className="border-t border-[#F5F6FA]">
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

        <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#F0F2F5] px-4 py-3.5">
            <span className="text-[13.5px] font-bold text-ink">Attività recente</span>
          </div>
          <div className="px-4 py-1">
            {feed.length === 0 && (
              <p className="py-3 text-xs text-ink-2">Nessun evento recente.</p>
            )}
            {feed.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 py-2.5 ${
                  i < feed.length - 1 ? "border-b border-[#F5F6FA]" : ""
                }`}
              >
                <div
                  className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: item.iconBg }}
                >
                  <i className={`ti ${item.icon}`} style={{ color: item.iconColor, fontSize: 12 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] leading-tight text-ink">{item.text}</div>
                  <div className="text-[10.5px] text-ink-3">{item.relativeLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        href="/center/servizi-consigliati"
        className="mt-4 flex items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF3D6] text-lg">
          <i className="ti ti-map-2 text-[#9A6B00]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">Servizi consigliati per il tuo centro</div>
          <div className="text-xs text-ink-2">Contatti selezionati da TRAMA (catering e altro)</div>
        </div>
        <i className="ti ti-chevron-right text-ink-3" />
      </Link>
    </div>
  );
}
