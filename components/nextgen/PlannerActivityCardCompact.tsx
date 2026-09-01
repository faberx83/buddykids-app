import Link from "next/link";
import { Activity } from "@/lib/types";

// TRAMA BETA v1.1.1 (UI Refinement, punto 8 — "Week Detail: ActivityCard
// compact variant") — components/ActivityCard.tsx (Scopri, NON toccata:
// "NON modificare Scopri") ha una copertina alta 140px + testo/tag sotto,
// pensata per l'esplorazione completa: nel Planner, dove serve solo
// decidere se il suggerimento è utile, occupava quasi uno schermo intero.
// Stessi identici dati già calcolati (Activity + matchPercent da
// computeSmartMatches, nessuna nuova query) — solo un rendering compatto,
// ad una riga, con le sole informazioni utili a decidere: match, titolo,
// centro, distanza, prezzo. Il dettaglio completo resta in Activity Detail
// (stesso Link di sempre, /activity/[id]).
//
// Principio della revisione: "Scopri = esploro tutti i dettagli. Planner =
// vedo la soluzione utile alla settimana."
export default function PlannerActivityCardCompact({
  activity,
  matchPercent,
  weekStartDate,
}: {
  activity: Activity;
  matchPercent?: number;
  weekStartDate?: string;
}) {
  return (
    <Link
      href={weekStartDate ? `/activity/${activity.id}?week=${weekStartDate}` : `/activity/${activity.id}`}
      className="flex items-center gap-3 rounded-xl bg-white p-3 active:bg-black/[0.06]"
    >
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-lg"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
      >
        {!activity.coverImageUrl && activity.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-ink">{activity.name}</span>
        <span className="block truncate text-[11px] text-ink-2">
          {activity.center} · {activity.distanceKm} km
        </span>
      </span>
      <span className="flex-shrink-0 text-right">
        <span className="block text-[11.5px] font-bold text-ink">€{activity.pricePerWeek}/sett.</span>
        {typeof matchPercent === "number" && (
          <span className="block text-[10px] font-semibold text-trama-violet">{matchPercent}% match</span>
        )}
      </span>
      <i className="ti ti-chevron-right flex-shrink-0 text-base text-ink-3" />
    </Link>
  );
}
