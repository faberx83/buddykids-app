import { notFound } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { activities, bookingsMock, centers } from "@/lib/mock-data";

export function generateStaticParams() {
  return centers.map((c) => ({ id: c.id }));
}

export default async function AdminCenterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const center = centers.find((c) => c.id === id);
  if (!center) return notFound();

  const centerActivities = activities.filter((a) => a.centerId === center.id);
  const centerBookings = bookingsMock.filter((b) =>
    centerActivities.some((a) => a.id === b.activityId)
  );

  return (
    <div>
      <Link href="/admin/centers" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky">
        <i className="ti ti-arrow-left" /> Tutti i centri
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ background: center.gradient }}
        >
          {center.emoji}
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">{center.name}</h1>
          <p className="text-sm text-ink-2">
            {center.address}, {center.city}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Descrizione
          </div>
          <p className="text-sm text-ink-2">{center.description}</p>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Contatti
          </div>
          <div className="space-y-1 text-sm text-ink-2">
            <div>
              <i className="ti ti-user mr-1.5 text-ink-3" />
              {center.ownerName}
            </div>
            <div>
              <i className="ti ti-mail mr-1.5 text-ink-3" />
              {center.contactEmail}
            </div>
            <div>
              <i className="ti ti-phone mr-1.5 text-ink-3" />
              {center.contactPhone}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Attività ({centerActivities.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {centerActivities.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">{a.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{a.name}</div>
                <div className="text-xs text-ink-2">
                  {a.ageRange} · €{a.pricePerWeek}/settimana
                </div>
              </div>
              <span className="text-xs font-semibold text-ink-2">
                ⭐ {a.rating} ({a.reviewsCount})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Prenotazioni ({centerBookings.length})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Bambino</th>
              <th className="px-4 py-2 font-medium">Genitore</th>
              <th className="px-4 py-2 font-medium">Totale</th>
              <th className="px-4 py-2 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {centerBookings.map((b) => (
              <tr key={b.id} className="border-t border-[#F0F2F5]">
                <td className="px-4 py-2.5 font-medium text-ink">{b.kidName}</td>
                <td className="px-4 py-2.5 text-ink-2">{b.parentName}</td>
                <td className="px-4 py-2.5 font-semibold text-ink">€{b.totalAmount}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
