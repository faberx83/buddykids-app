import Link from "next/link";
import { activities, centers } from "@/lib/mock-data";

export default function AdminActivitiesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Attività</h1>
        <p className="text-sm text-ink-2">Tutte le attività pubblicate su tutti i centri</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Centro</th>
              <th className="px-4 py-3 font-medium">Età</th>
              <th className="px-4 py-3 font-medium">Prezzo/sett.</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => {
              const center = centers.find((c) => c.id === a.centerId);
              return (
                <tr key={a.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="font-semibold text-ink">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{center?.name}</td>
                  <td className="px-4 py-3 text-ink-2">{a.ageRange}</td>
                  <td className="px-4 py-3 font-semibold text-ink">€{a.pricePerWeek}</td>
                  <td className="px-4 py-3 text-ink-2">
                    ⭐ {a.rating} ({a.reviewsCount})
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/activity/${a.id}`} className="text-xs font-semibold text-sky">
                      Vedi scheda →
                    </Link>
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
