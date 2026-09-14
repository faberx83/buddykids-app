// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B9 "UX Planner"),
// colori/wording aggiornati per SCHOOL CALENDAR UX REFINEMENT (§5 "SCHOOL
// CALENDAR NELLE SETTIMANE" + §6 "PARTIAL SCHOOL CLOSURES"). Badge
// INFORMATIVO puro — nessun onClick, nessuna nuova rotta/tab: la riga che lo
// contiene (Prossime settimane da completare / Timeline completa) è già un
// <Link> verso il Dettaglio Settimana esistente, questo componente si limita
// ad aggiungere il contesto "Scuola chiusa · ..." accanto al testo già
// presente — §B9/§1: "School Calendar deve diventare intelligence del
// Planner" (mai un tab/superficie a sé, mai sostituire lo stato Planner
// esistente).
//
// Non renderizza nulla per "school_open"/"no_school_context" SENZA una nota
// parziale (§B14/§6: zero rumore quando non c'è nulla da segnalare) — §5:
// "SCHOOL OPEN: NESSUN badge. Non aggiungere rumore visuale."
//
// §5 colori esatti (via token TRAMA equivalenti, non hardcoded — vedi
// tailwind.config.ts): closed_to_organize -> trama-coral 10%, closed_covered
// -> trama-green 10%, closed_not_needed -> neutrale esistente (MAI
// coral/rosso). §6: la nota "1-4 giorni chiusi" usa trama-violet 8% — colore
// diverso di proposito dai tre badge sopra, per non essere confusa con un
// segnale di stato pieno (è solo contesto informativo, mai uno stato).

import { SCHOOL_WEEK_NEED_LABEL, type SchoolWeekNeed } from "@/lib/school-calendar/need-core";

const BADGE_CLASS: Partial<Record<SchoolWeekNeed, string>> = {
  closed_to_organize: "bg-trama-coral/10 text-trama-coral",
  closed_covered: "bg-trama-green/10 text-trama-green",
  closed_not_needed: "bg-[#F0F2F5] text-ink-2",
};

export default function SchoolWeekBadge({
  need,
  partialClosureNote,
}: {
  need: SchoolWeekNeed | undefined;
  // §6: testo informativo ("Scuola chiusa mer 2" / "3 giorni senza scuola")
  // — SOLO rilevante quando need è "school_open" (o assente): se la
  // settimana è già "closed_*", il badge sotto la copre già, questa nota
  // non deve MAI comparire insieme a un badge pieno (evitato anche a monte,
  // lib/data/school-calendar.ts la calcola solo per "school_open").
  partialClosureNote?: string;
}) {
  if (need && need !== "school_open" && need !== "no_school_context") {
    const label = SCHOOL_WEEK_NEED_LABEL[need];
    if (label) {
      return (
        <span className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_CLASS[need]}`}>
          <i className="ti ti-school text-[11px]" />
          {label}
        </span>
      );
    }
  }

  if (partialClosureNote) {
    return (
      <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-trama-violet/[0.08] px-2 py-0.5 text-[10px] font-semibold text-trama-violet">
        <i className="ti ti-calendar-event text-[11px]" />
        {partialClosureNote}
      </span>
    );
  }

  return null;
}
