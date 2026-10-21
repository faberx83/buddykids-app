// TRAMA — CORREZIONI DAL TEST UX (21/10/2026, PARENT_UX_FIX_ENABLED),
// UX-PARENT-004. Sotto i riepiloghi delle chiusure (Home e Planner →
// Stagione): per quanti figli c'è il calendario della scuola, chi manca e un
// collegamento diretto alla sua scheda in "La tua famiglia". Senza figli
// scoperti non mostra niente. Logica in lib/nextgen/parent-ux-fix.ts.

import Link from "next/link";
import { schoolCoverageNote, schoolSetupHref, type SchoolCoverage } from "@/lib/nextgen/parent-ux-fix";

export default function SchoolCoverageNote({ coverage, className = "" }: { coverage: SchoolCoverage | null; className?: string }) {
  if (!coverage) return null;
  const note = schoolCoverageNote(coverage);
  if (!note) return null;
  return (
    <div
      data-testid="school-coverage-note"
      className={`flex items-start gap-3 rounded-2xl border border-[#F3D9A4] bg-[#FFF8EB] px-4 py-3 ${className}`}
    >
      <i className="ti ti-school mt-0.5 text-[17px] text-[#7A4500]" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13.5px] leading-snug text-[#5C3A00]">{note.text}</span>
        <Link href={schoolSetupHref(note.kidId)} className="flex min-h-[36px] items-center text-[13.5px] font-bold text-trama-accent-ink">
          {note.ctaLabel}
        </Link>
      </span>
    </div>
  );
}
