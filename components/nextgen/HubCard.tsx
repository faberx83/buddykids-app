import Link from "next/link";
import { ComingSoonBadge } from "@/components/StatusBadge";

// SPRINT CORRETTIVO (estratto da ProfileNextgenClient.tsx) — Fabrizio ha
// chiesto se avesse senso "promuovere" la sezione Famiglia in bottom nav
// insieme a Planner/Scopri: no (sono impostazioni "una tantum", non
// destinazioni quotidiane — vedi commenti in ProfileNextgenClient), ma la
// discussione ha fatto notare che 4 righe intere sotto un solo header
// danno comunque troppo peso visivo in Profilo. Estratto qui perché ora
// serve in più punti: la lista principale di Profilo E le nuove
// sotto-pagine hub (Famiglia e logistica, Impostazioni) che raccolgono le
// righe consolidate dietro un solo ingresso.
export default function HubCard({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  comingSoon,
}: {
  href?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: number;
  comingSoon?: boolean;
}) {
  const clickable = Boolean(href && !comingSoon);
  const content = (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white p-4 ${comingSoon ? "opacity-60" : ""} ${
        clickable ? "active:bg-black/[0.06]" : ""
      }`}
    >
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[19px]"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <i className={`ti ${icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
          {title}
          {comingSoon && <ComingSoonBadge />}
        </div>
        {subtitle && <div className="text-[11.5px] text-ink-2">{subtitle}</div>}
      </div>
      {comingSoon ? null : badge !== undefined && badge > 0 ? (
        <span className="flex-shrink-0 rounded-full bg-trama-orange px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : (
        <i className="ti ti-chevron-right flex-shrink-0 text-[16px] text-ink-3" />
      )}
    </div>
  );

  return href && !comingSoon ? <Link href={href}>{content}</Link> : content;
}
