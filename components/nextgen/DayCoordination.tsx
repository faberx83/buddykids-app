"use client";

// TRAMA — chi accompagna in una giornata (14/10/2026). Componente CONDIVISO
// tra Home V2 ("Oggi") e Planner V2 (ogni giorno della Settimana), estratto
// da HomeDashboardV2Client.tsx: stesse regole, stesse parole.
//   compact  → una riga "Accompagnamenti decisi · Papà e Mamma", espandibile
//   detailed → tabella Porta/Ritira per figlio con "da decidere" + Assegna
//   none     → niente
// Modello dati invariato: figlio + giorno + momento (week_responsibilities).

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { joinPeople, type DayCoordinationSummary } from "@/lib/nextgen/today-agenda";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";

export function CoordinationTable({
  coordination,
  kidOrder,
  padded = false,
}: {
  coordination: DayCoordinationSummary;
  kidOrder: string[];
  padded?: boolean;
}) {
  const cell = (value: string | null | undefined) => {
    if (value === undefined) return <span className="text-ink-2">—</span>;
    if (value === null)
      return (
        <span className="justify-self-start rounded-full border-[1.5px] border-dashed border-[#E0A040] px-2.5 py-0.5 font-bold text-[#7A4500]">
          da decidere
        </span>
      );
    return <span className="font-semibold text-ink">{value}</span>;
  };
  return (
    <div className={`grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-[13px] ${padded ? "px-4 pb-3" : ""}`}>
      <span />
      <span className="text-[11.5px] text-ink-2">Porta</span>
      <span className="text-[11.5px] text-ink-2">Ritira</span>
      {coordination.kids.map((k) => (
        <KidCells key={k.kidId} kid={k} kidOrder={kidOrder} cell={cell} />
      ))}
    </div>
  );
}

function KidCells({
  kid,
  kidOrder,
  cell,
}: {
  kid: DayCoordinationSummary["kids"][number];
  kidOrder: string[];
  cell: (value: string | null | undefined) => ReactNode;
}) {
  return (
    <>
      <span title={kid.kidName}>
        <KidAvatar name={kid.kidName} tone={kidToneFor(kid.kidId, kidOrder)} size={24} />
        <span className="sr-only">{kid.kidName}</span>
      </span>
      {cell(kid.andata)}
      {cell(kid.ritorno)}
    </>
  );
}

/** Chiude una card di impegni: riga compressa o tabella "Chi accompagna …". */
export default function DayCoordinationBlock({
  coordination,
  kidOrder,
  title,
  assignHref,
  onAssign,
}: {
  coordination: DayCoordinationSummary;
  kidOrder: string[];
  /** "Chi accompagna oggi", "Chi accompagna martedì". */
  title: string;
  /** Link "Assegna" (Home) oppure… */
  assignHref?: string;
  /** …azione "Assegna" sul posto (Planner). */
  onAssign?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (coordination.mode === "none") return null;

  const assignCta = "flex min-h-[32px] items-center text-[13px] font-bold text-[#5B4FB0]";
  const assign = onAssign ? (
    <button type="button" onClick={onAssign} className={assignCta}>
      {coordination.mode === "compact" ? "Modifica" : "Assegna"}
    </button>
  ) : assignHref ? (
    <Link href={assignHref} className={assignCta}>
      {coordination.mode === "compact" ? "Modifica" : "Assegna"}
    </Link>
  ) : null;

  if (coordination.mode === "compact") {
    return (
      <div className="rounded-b-[20px]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[46px] w-full items-center gap-2 px-4 text-left text-[12.5px] text-[#4B5563]"
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#E6F6F0] text-[#146B4F]">
            <i className="ti ti-check text-[11px]" aria-hidden="true" />
          </span>
          <span className="flex-1">Accompagnamenti decisi · {joinPeople(coordination.people)}</span>
          <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-[16px] text-ink-2`} aria-hidden="true" />
        </button>
        {open && (
          <div className="flex flex-col gap-1 pb-1">
            <CoordinationTable coordination={coordination} kidOrder={kidOrder} padded />
            {assign && <div className="flex justify-end px-4 pb-2">{assign}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-b-[20px] bg-[#FBFAF7] px-4 pb-3.5 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-2">{title}</span>
        {assign}
      </div>
      <CoordinationTable coordination={coordination} kidOrder={kidOrder} />
    </div>
  );
}
