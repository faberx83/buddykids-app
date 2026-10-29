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
import { openChiAccompagna } from "@/lib/nextgen/chi-accompagna-open";
import { missingPassagesLine } from "@/lib/nextgen/passage-busy-day";
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

  const assignCta = "flex min-h-[44px] items-center px-1 text-[13px] font-bold text-trama-accent-ink";
  const assign = onAssign ? (
    <button type="button" onClick={onAssign} className={assignCta}>
      {coordination.mode === "compact" ? "Modifica" : "Assegna"}
    </button>
  ) : assignHref ? (
    <Link href={assignHref} onClick={(e) => openChiAccompagna(assignHref) && e.preventDefault()} className={assignCta}>
      {coordination.mode === "compact" ? "Modifica" : "Assegna"}
    </Link>
  ) : null;

  // 29/10/2026 (UX-PARENT-024): con i passaggi (stesso conteggio del Planner,
  // scuola compresa) "decisi" compare solo se TUTTI i passaggi hanno qualcuno;
  // altrimenti "N passaggi da decidere · Luca" e i passaggi per figlio.
  if (coordination.passageKids) {
    const kidsRows = (
      <div className="flex flex-col gap-2">
        {coordination.passageKids.map((k) => (
          <div key={k.kidId} className="flex items-start gap-2.5" data-testid="home-passage-kid">
            <KidAvatar name={k.kidName} tone={kidToneFor(k.kidId, kidOrder)} size={24} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[13px] font-semibold text-ink">{k.kidName}</span>
              <span className="flex flex-wrap gap-1">
                {k.chips.map((c) => (
                  <span
                    key={c.key}
                    className={`flex min-h-[24px] items-center gap-1 rounded-full px-2 text-[12px] ${
                      c.label === null ? "bg-[#FFF3E0] font-bold text-[#7A4500]" : "border border-[#E3E6EC] font-semibold text-ink"
                    }`}
                  >
                    <span className="tabular-nums opacity-80">{c.time ?? ""}</span>
                    {c.label ?? "Chi?"}
                  </span>
                ))}
              </span>
            </span>
          </div>
        ))}
      </div>
    );
    if (coordination.mode === "compact") {
      return (
        <div className="rounded-b-[20px]" data-testid="home-passages-done">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-[46px] w-full items-center gap-2 px-4 text-left text-[12.5px] text-[#4B5563]"
          >
            <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#E6F6F0] text-[#146B4F]">
              <i className="ti ti-check text-[11px]" aria-hidden="true" />
            </span>
            <span className="flex-1">Accompagnamenti decisi per oggi · {joinPeople(coordination.people)}</span>
            <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-[16px] text-ink-2`} aria-hidden="true" />
          </button>
          {open && (
            <div className="flex flex-col gap-2 px-4 pb-3">
              {kidsRows}
              {assign && <div className="flex justify-end">{assign}</div>}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2.5 rounded-b-[20px] bg-[#FBFAF7] px-4 pb-3.5 pt-3" data-testid="home-passages-missing">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink-2">{title}</span>
          {assign}
        </div>
        <span className="text-[13px] font-semibold text-[#8A4B00]">{missingPassagesLine(coordination.passageKids)}</span>
        {assignHref ? (
          <Link href={assignHref} onClick={(e) => openChiAccompagna(assignHref) && e.preventDefault()} aria-label={`${title}: scegli chi accompagna`} className="-mx-1 block rounded-xl px-1 py-0.5 active:bg-black/[0.03]">
            {kidsRows}
          </Link>
        ) : onAssign ? (
          <button type="button" onClick={onAssign} className="-mx-1 rounded-xl px-1 py-0.5 text-left active:bg-black/[0.03]">
            {kidsRows}
          </button>
        ) : (
          kidsRows
        )}
      </div>
    );
  }

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

  // 20/10/2026 (Fabrizio: "se clicco da decidere torna indietro… semplifichiamo"):
  // anche la tabella, con i suoi "da decidere", apre la scelta, non solo "Assegna".
  const table = <CoordinationTable coordination={coordination} kidOrder={kidOrder} />;
  const tableLabel = `${title}: scegli chi porta e chi ritira`;
  return (
    <div className="flex flex-col gap-2.5 rounded-b-[20px] bg-[#FBFAF7] px-4 pb-3.5 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-2">{title}</span>
        {assign}
      </div>
      {onAssign ? (
        <button type="button" onClick={onAssign} aria-label={tableLabel} className="-mx-1 rounded-xl px-1 py-0.5 text-left active:bg-black/[0.03]">
          {table}
        </button>
      ) : assignHref ? (
        <Link href={assignHref} aria-label={tableLabel} onClick={(e) => openChiAccompagna(assignHref) && e.preventDefault()} className="-mx-1 block rounded-xl px-1 py-0.5 active:bg-black/[0.03]">
          {table}
        </Link>
      ) : (
        table
      )}
    </div>
  );
}
