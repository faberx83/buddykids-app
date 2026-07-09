export default function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  elevated,
}: {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  // Stile "card bianca con ombra leggera, niente bordo" del redesign
  // Dashboard Partner (handoff 6a) — di default resta il vecchio stile con
  // bordo (usato anche da Admin), per non cambiare l'aspetto di sezioni non
  // toccate da quel redesign.
  elevated?: boolean;
}) {
  return (
    <div
      className={
        elevated
          ? "rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : "rounded-lg border border-[#E8EBF0] bg-white p-4"
      }
    >
      <div
        className={`mb-3 flex h-[34px] w-[34px] items-center justify-center text-lg ${
          elevated ? "rounded-[9px]" : "rounded-md"
        }`}
        style={{ background: iconBg }}
      >
        <i className={`ti ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-ink-2">{label}</div>
    </div>
  );
}
