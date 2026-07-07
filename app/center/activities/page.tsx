import Link from "next/link";
import { getActivitiesForCenter } from "@/lib/data/activities";
import { getCenterContext } from "@/lib/data/center-admin";

export default async function CenterActivitiesPage() {
  const { centerDbId, centerSlug } = await getCenterContext();
  const myActivities = await getActivitiesForCenter(centerDbId, centerSlug);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Le tue attività</h1>
          <p className="text-sm text-ink-2">Gestisci informazioni, calendario e disponibilità</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {myActivities.map((a) => (
          <div key={a.id} className="rounded-lg border border-[#E8EBF0] bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl">{a.emoji}</span>
              <div>
                <div className="text-sm font-bold text-ink">{a.name}</div>
                <div className="text-xs text-ink-2">
                  {a.ageRange} · €{a.pricePerWeek}/settimana
                </div>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-ink-2">
              <i className="ti ti-star-filled text-yellow" />
              {a.rating} ({a.reviewsCount} recensioni)
              {a.spotsLeft !== undefined && (
                <span className="ml-auto rounded-full bg-yellow-light px-2 py-0.5 font-semibold text-[#9a6b00]">
                  {a.spotsLeft} posti rimasti
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/center/activities/${a.id}`}
                className="flex-1 rounded-md border border-[#E8EBF0] py-2 text-center text-xs font-semibold text-ink transition-colors hover:bg-bg"
              >
                Modifica scheda
              </Link>
              <Link
                href={`/center/activities/${a.id}/calendar`}
                className="flex-1 rounded-md bg-sky py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-[#3A9FDC]"
              >
                Calendario disponibilità
              </Link>
            </div>
          </div>
        ))}
        {myActivities.length === 0 && (
          <p className="text-sm text-ink-2">Nessuna attività trovata per il tuo centro.</p>
        )}
      </div>
    </div>
  );
}
