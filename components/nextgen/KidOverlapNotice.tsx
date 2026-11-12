// TRAMA — AVVISO SOVRAPPOSIZIONI NEL PLANNER (12/11/2026). Retest Parent di
// Fabrizio: "due attività confermate dello stesso bambino e con orari
// sovrapposti devono generare un avviso prima dell'assegnazione dei
// passaggi. Non bloccare automaticamente il flusso". In cima al foglio "Chi
// accompagna" del Planner, dietro PLANNER_OVERLAP_WARNING_ENABLED (spento =
// nessun avviso, come prima). Solo testo: niente pulsanti, niente blocchi.
// Logica: lib/nextgen/kid-overlaps.ts.

import { kidTimeOverlaps, overlapSentence } from "@/lib/nextgen/kid-overlaps";
import type { AgendaEntry } from "@/lib/nextgen/today-agenda";

export default function KidOverlapNotice({ entries, enabled }: { entries: AgendaEntry[]; enabled: boolean }) {
  if (!enabled) return null;
  const overlaps = kidTimeOverlaps(entries);
  if (overlaps.length === 0) return null;
  return (
    <div role="status" data-testid="kid-overlap-notice" className="mb-3 flex gap-2.5 rounded-2xl border border-[#E0A040] bg-[#FFF8EC] px-3.5 py-3 text-[13.5px] text-[#7A4500]">
      <i className="ti ti-alert-triangle mt-0.5 text-[18px]" aria-hidden="true" />
      <ul className="flex flex-col gap-1">
        {overlaps.map((o) => (
          <li key={`${o.kidId}-${o.a.id}-${o.b.id}`}>{overlapSentence(o)}</li>
        ))}
      </ul>
    </div>
  );
}
