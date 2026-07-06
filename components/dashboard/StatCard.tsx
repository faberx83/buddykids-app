export default function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-md text-lg"
        style={{ background: iconBg }}
      >
        <i className={`ti ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-ink-2">{label}</div>
    </div>
  );
}
