import Link from "next/link";
import { Activity } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function ActivityCardHorizontal({
  activity,
  week,
  kid,
}: {
  activity: Activity;
  // Settimana (startDate ISO) selezionata in Cerca da "Riempi" nel Planner —
  // portata avanti nel link cosi il dettaglio attività (e poi la
  // prenotazione) la ritrovano preselezionata.
  week?: string | null;
  // Se in Home era selezionato un bambino specifico (famiglie con più
  // figli), portiamo avanti anche quello: cosi in Prenotazione risulta già
  // spuntato il bambino giusto invece del primo della lista.
  kid?: string | null;
}) {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  if (kid) params.set("kid", kid);
  const query = params.toString();

  return (
    <Link
      href={query ? `/activity/${activity.id}?${query}` : `/activity/${activity.id}`}
      className="mx-5 mb-3 flex h-[106px] cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.98] hover:shadow-md"
    >
      <div
        className="flex w-[106px] flex-shrink-0 items-center justify-center bg-cover bg-center text-5xl"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
      >
        {/* Foto reale caricata dal gestore, se presente — prima questa card
            mostrava sempre e solo l'emoji/gradiente, mai la copertina. */}
        {!activity.coverImageUrl && activity.emoji}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div className="text-[13px] font-bold text-ink">{activity.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <i className="ti ti-map-pin" />
          {activity.distanceKm} km · {activity.ageRange}
        </div>
        <div className="my-0.5 flex flex-wrap gap-1">
          {activity.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillClasses[tag.color]}`}
            >
              {tag.label.replace(/^\S+\s/, "")}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            €{activity.pricePerWeek}
            <span className="text-[10px] font-normal text-ink-2">/sett</span>
          </div>
          <div className="flex items-center gap-0.5 text-[11px] font-semibold text-ink">
            <i className="ti ti-star-filled text-yellow" />
            {activity.rating}
          </div>
        </div>
      </div>
    </Link>
  );
}
