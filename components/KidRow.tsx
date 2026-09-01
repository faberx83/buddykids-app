"use client";

import { Kid } from "@/lib/types";

// nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel flusso di
// prenotazione): usato SOLO da app/booking/[id]/BookingClient.tsx (nessun
// altro call site), quindi sicuro da estendere con lo stesso pattern di
// StepIndicator.tsx/GroupDetailClient.tsx senza rischiare di toccare pagine
// Legacy-only. Legacy (default false) resta invariato.
export default function KidRow({
  kid,
  selected,
  onToggle,
  nextgen = false,
}: {
  kid: Kid;
  selected: boolean;
  onToggle: () => void;
  nextgen?: boolean;
}) {
  const accentBg = nextgen ? "bg-trama-violet" : "bg-sky";
  const accentBorder = nextgen ? "border-trama-violet" : "border-sky";
  const accentLight = nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  return (
    <div
      onClick={onToggle}
      // Niente ":hover" quando non selezionato: su mobile lo stato hover può
      // restare "incollato" dopo un tap, e usando gli stessi colori dello
      // stato selezionato (border-sky/bg-sky-light) un bambino deselezionato
      // sembrava ancora spuntato.
      className={`mb-2 flex cursor-pointer items-center gap-3 rounded-md border-[1.5px] p-3 transition-colors ${
        selected ? `${accentBorder} ${accentLight}` : "border-[#F0F2F5] bg-white"
      }`}
    >
      <div
        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full text-xl"
        style={{ background: kid.color }}
      >
        {kid.emoji}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">
          {kid.name}, {kid.age} anni
        </div>
        <div className="text-xs text-ink-2">{kid.note}</div>
      </div>
      <div
        className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
          selected ? `${accentBorder} ${accentBg} text-white` : "border-[#D0D5DD]"
        }`}
      >
        {selected && <i className="ti ti-check text-xs" />}
      </div>
    </div>
  );
}
