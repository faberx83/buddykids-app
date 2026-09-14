// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B9 "UX Planner").
// Badge INFORMATIVO puro — nessun onClick, nessuna nuova rotta/tab: la riga
// che lo contiene (Prossime settimane da completare / Timeline completa) è
// già un <Link> verso il Dettaglio Settimana esistente, questo componente si
// limita ad aggiungere il contesto "Scuola chiusa · ..." accanto al testo
// già presente — §B9: "Il calendario scolastico deve comparire come
// intelligence/contesto" (mai un tab/superficie a sé, mai sostituire lo
// stato Planner esistente).
//
// Non renderizza nulla per "school_open"/"no_school_context" (§B14: zero
// rumore quando non c'è nulla da segnalare).

import { SCHOOL_WEEK_NEED_LABEL, type SchoolWeekNeed } from "@/lib/school-calendar/need-core";

const BADGE_CLASS: Partial<Record<SchoolWeekNeed, string>> = {
  closed_to_organize: "bg-[#FFF7E6] text-[#9a6b00]",
  closed_covered: "bg-green-light text-[#2d8f52]",
  closed_not_needed: "bg-[#F0F2F5] text-ink-2",
};

export default function SchoolWeekBadge({ need }: { need: SchoolWeekNeed | undefined }) {
  if (!need || need === "school_open" || need === "no_school_context") return null;
  const label = SCHOOL_WEEK_NEED_LABEL[need];
  if (!label) return null;

  return (
    <span className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_CLASS[need]}`}>
      <i className="ti ti-school text-[11px]" />
      {label}
    </span>
  );
}
