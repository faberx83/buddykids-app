import Link from "next/link";
import { ComingSoonBadge } from "@/components/StatusBadge";

export default function MenuItem({
  icon,
  iconBg,
  iconColor,
  main,
  sub,
  badge,
  href,
  comingSoon,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  main: string;
  sub?: string;
  badge?: number;
  href?: string;
  comingSoon?: boolean;
}) {
  const content = (
    <div
      className={`mb-1.5 flex items-center gap-3 rounded-md border border-[#F0F2F5] bg-white p-3.5 transition-colors ${
        comingSoon ? "opacity-70" : "cursor-pointer hover:bg-[#FAFBFD]"
      }`}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm text-lg"
        style={{ background: iconBg }}
      >
        <i className={`ti ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          {main}
          {comingSoon && <ComingSoonBadge />}
        </div>
        {sub && <div className="mt-px text-[11px] text-ink-2">{sub}</div>}
      </div>
      {comingSoon ? null : badge !== undefined ? (
        <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : (
        <i className="ti ti-chevron-right text-lg text-ink-3" />
      )}
    </div>
  );

  return href && !comingSoon ? <Link href={href}>{content}</Link> : content;
}
