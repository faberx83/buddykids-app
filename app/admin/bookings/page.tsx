import StatusBadge from "@/components/dashboard/StatusBadge";
import { activities, bookingsMock } from "@/lib/mock-data";

export default function AdminBookingsPage() {
  const sorted = [...bookingsMock].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Prenotazioni</h1>
        <p className="text-sm text-ink-2">Tutte le prenotazioni su tutti i centri</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Bambino</th>
              <th className="px-4 py-3 font-medium">Genitore</th>
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Periodo</th>
              <th className="px-4 py-3 font-medium">Totale</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const activity = activities.find((a) => a.id === b.activityId);
              return (
                <tr key={b.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{b.kidName}</td>
                  <td className="px-4 py-3 text-ink-2">{b.parentName}</td>
                  <td className="px-4 py-3 text-ink-2">{activity?.name}</td>
                  <td className="px-4 py-3 text-ink-2">{b.weeksLabel}</td>
                  <td className="px-4 py-3 font-semibold text-ink">€{b.totalAmount}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {new Date(b.createdAt).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
