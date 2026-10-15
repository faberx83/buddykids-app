"use client";

import { Kid } from "@/lib/types";
import { KID_TONES } from "@/components/nextgen/AgendaItemRow";
import { interestLabel, kidInitial } from "@/lib/nextgen/kid-visual";

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
  v2 = false,
  toneIndex = 0,
}: {
  kid: Kid;
  selected: boolean;
  onToggle: () => void;
  nextgen?: boolean;
  /** 15/10/2026 — richiesta V2: iniziale sulla tinta del figlio al posto della faccina, interessi senza emoji. */
  v2?: boolean;
  toneIndex?: number;
}) {
  if (v2) {
    const tone = KID_TONES[toneIndex % KID_TONES.length];
    const interests = (kid.interests ?? []).map(interestLabel).slice(0, 3).join(", ");
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={`mb-2 flex min-h-[64px] w-full items-center gap-3 rounded-2xl border p-3 text-left ${
          selected ? "border-trama-primary bg-trama-primary-soft" : "border-trama-line bg-white"
        }`}
      >
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-poppins text-[16px] font-semibold ${tone.bg} ${tone.text}`}>
          {kidInitial(kid.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-ink">
            {kid.name}, {kid.age} anni
          </span>
          {interests && <span className="truncate text-[12.5px] text-ink-2">{interests}</span>}
        </span>
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-trama-primary bg-trama-primary text-white" : "border-[#D0D5DD]"
          }`}
        >
          {selected && <i className="ti ti-check text-xs" aria-hidden="true" />}
        </span>
      </button>
    );
  }
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
