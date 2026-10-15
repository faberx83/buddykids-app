// TRAMA — segno V2 per righe senza foto (gruppi, Classe e scuola, proposte):
// monogramma su carta con il filo colorato in alto, al posto delle emoji.
// Spostato qui da PlannerGroupsView (15/10/2026) per riusarlo in Classe e scuola.

import { monogramFor, threadColorFor } from "@/components/nextgen/ActivityVisual";

export default function RowMark({ title, size = 40 }: { title: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-trama-line bg-[#F4F1EA] font-poppins text-[14px] font-semibold text-trama-navy/80"
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: threadColorFor(title) }} />
      {monogramFor(title)}
    </span>
  );
}
