"use client";

export default function CategoryChip({
  emoji,
  label,
  bg,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  bg: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex min-w-[70px] flex-shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border-[1.5px] px-3.5 py-2 transition-colors ${
        selected
          ? "border-sky bg-sky"
          : "border-[#EDF0F4] bg-white hover:border-sky hover:bg-sky"
      }`}
    >
      <div
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-xl"
        style={{ background: bg }}
      >
        {emoji}
      </div>
      <span
        className={`text-[11px] font-medium ${
          selected ? "text-white" : "text-ink-2 group-hover:text-white"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
