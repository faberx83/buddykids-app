"use client";

import { Week } from "@/lib/types";
import { shortWeekLabel } from "@/lib/season-weeks";

export default function WeekCard({
  week,
  selected,
  onToggle,
  alreadyBooked,
}: {
  week: Week;
  selected: boolean;
  onToggle: () => void;
  // Vero se questa settimana è già in una prenotazione confermata del
  // genitore per questa stessa attività — non deve essere ri-selezionabile
  // (eviteremmo una doppia prenotazione della stessa settimana/campus).
  alreadyBooked?: boolean;
}) {
  // "Non offerta qui": l'attività non copre questa settimana della stagione
  // (mostrata comunque, per restare allineati alla griglia di 13 settimane
  // del Planner) — diverso da "sold out", quindi etichetta diversa.
  if (week.offered === false) {
    return (
      <div className="cursor-not-allowed rounded-md border-[1.5px] border-dashed border-[#E8EBF0] bg-[#FAFBFD] p-3 opacity-60">
        <div className="text-[13px] font-semibold text-ink-2">{week.dates}</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase text-ink-3">{shortWeekLabel(week.label)}</div>
        <div className="mt-1 text-[11px] font-medium text-ink-3">Non attiva qui</div>
      </div>
    );
  }

  if (alreadyBooked) {
    return (
      <div className="cursor-not-allowed rounded-md border-[1.5px] border-green bg-green-light p-3">
        <div className="text-[13px] font-semibold text-ink">{week.dates}</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase text-ink-3">{shortWeekLabel(week.label)}</div>
        <div className="mt-1 text-[11px] font-medium text-green">✓ Già prenotata</div>
      </div>
    );
  }

  if (week.soldOut) {
    return (
      <div className="cursor-not-allowed rounded-md border-[1.5px] border-orange-mid bg-orange-light p-3 opacity-70">
        <div className="text-[13px] font-semibold text-ink">{week.dates}</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase text-ink-3">
          {shortWeekLabel(week.label)}
        </div>
        <div className="mt-1 text-[11px] font-medium text-[#d4622a]">✗ Pieno</div>
      </div>
    );
  }

  const low = week.spots <= 3;

  return (
    <div
      onClick={onToggle}
      // Niente stili ":hover" qui: su mobile un tap può far "restare incollato"
      // lo stato hover (finché l'utente non tocca altrove), e siccome l'hover
      // usava esattamente gli stessi colori dello stato "selected"
      // (border-sky/bg-sky-light), una settimana deselezionata sembrava
      // ancora selezionata. Lo stato attivo resta comunicato solo da
      // `selected`, che è quello vero.
      className={`relative cursor-pointer rounded-md border-[1.5px] p-3 transition-colors ${
        selected
          ? "border-sky bg-sky-light ring-2 ring-sky/30"
          : low
          ? "border-yellow bg-yellow-light"
          : "border-[#E8EBF0] bg-white"
      }`}
    >
      {selected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky text-white shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
          <i className="ti ti-check text-[12px]" />
        </div>
      )}
      <div className="text-[13px] font-semibold text-ink">{week.dates}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase text-ink-3">
        {shortWeekLabel(week.label)}
      </div>
      <div
        className={`mt-1 text-[11px] font-medium ${
          selected ? "text-sky" : low ? "text-[#9a6b00]" : "text-green"
        }`}
      >
        {selected ? "✓ Selezionata" : low ? `⚡ ultimi ${week.spots}` : `✓ ${week.spots} posti`}
      </div>
    </div>
  );
}
