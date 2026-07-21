import Link from "next/link";
import { Activity } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function ActivityCardHorizontal({
  activity,
  week,
  kid,
  source,
  correlationId,
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
  // TRAMA ONE Build Sprint 3 — "context object" leggero (source/
  // correlationId): da dove arriva il click (es. "search") e un id univoco
  // per correlare i log dell'intero percorso ricerca→dettaglio→richiesta
  // (vedi lib/telemetry/correlation.ts). Facoltativi: se assenti, il link
  // resta esattamente quello di prima (nessun impatto sui punti che non li
  // passano ancora).
  source?: string;
  correlationId?: string;
}) {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  if (kid) params.set("kid", kid);
  if (source) params.set("source", source);
  if (correlationId) params.set("cid", correlationId);
  const query = params.toString();

  return (
    <Link
      href={query ? `/activity/${activity.id}?${query}` : `/activity/${activity.id}`}
      className="mx-5 mb-3 flex h-[106px] cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.98] hover:shadow-md"
    >
      <div
        className="relative flex w-[106px] flex-shrink-0 items-center justify-center bg-cover bg-center text-5xl"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
      >
        {/* Foto reale caricata dal gestore, se presente — prima questa card
            mostrava sempre e solo l'emoji/gradiente, mai la copertina. */}
        {!activity.coverImageUrl && activity.emoji}
        {/* Segnalazione di Fabrizio: né il badge disabili né quello diete
            comparivano sulla card — stesso gap già risolto per le
            certificazioni (dati già presenti in Activity, mancava solo il
            rendering qui). Icone impilate nell'angolo, card troppo stretta
            per etichette testuali complete. */}
        {(activity.certificationBadges?.length ||
          activity.centerAccessible ||
          (activity.dietaryOptions && activity.dietaryOptions.length > 0)) && (
          <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
            {activity.certificationBadges && activity.certificationBadges.length > 0 && (
              <div
                title={activity.certificationBadges.join(", ")}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-sky"
              >
                <i className="ti ti-certificate text-[12px]" />
              </div>
            )}
            {/* SPRINT 3 (feedback Fabrizio) — stesso restyle di ActivityCard.tsx:
                viola invece di blu (distinguibile dalla certificazione),
                testo "Nessuna limitazione" invece di "Accesso disabili". */}
            {activity.centerAccessible && (
              <div
                title="Nessuna limitazione"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-purple"
              >
                <i className="ti ti-heart-handshake text-[12px]" />
              </div>
            )}
            {activity.dietaryOptions && activity.dietaryOptions.length > 0 && (
              <div
                title={`Diete gestite: ${activity.dietaryOptions.join(", ")}`}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-green"
              >
                <i className="ti ti-salad text-[12px]" />
              </div>
            )}
          </div>
        )}
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
              style={tag.bg ? { backgroundColor: tag.bg } : undefined}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                tag.bg ? "text-ink" : pillClasses[tag.color!]
              }`}
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
