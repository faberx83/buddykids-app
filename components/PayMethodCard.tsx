"use client";

export default function PayMethodCard({
  icon,
  name,
  sub,
  selected,
  onSelect,
}: {
  icon: string;
  name: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      // Niente ":hover" quando non selezionato (stesso bug di WeekCard/KidRow:
      // su mobile l'hover puo' restare attivo dopo il tap e, avendo gli
      // stessi colori dello stato selezionato, un metodo deselezionato
      // sembrava ancora scelto).
      className={`mb-2 flex cursor-pointer items-center gap-3 rounded-md border-[1.5px] p-3.5 transition-colors ${
        selected ? "border-sky bg-sky-light" : "border-[#E8EBF0] bg-white"
      }`}
    >
      <i className={`ti ${icon} text-[22px] text-ink-3`} />
      <div>
        <div className="text-[13px] font-semibold text-ink">{name}</div>
        <div className="text-[11px] text-ink-2">{sub}</div>
      </div>
      <div
        className={`relative ml-auto h-5 w-5 flex-shrink-0 rounded-full border-2 ${
          selected ? "border-sky" : "border-[#D0D5DD]"
        }`}
      >
        {selected && (
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky" />
        )}
      </div>
    </div>
  );
}
