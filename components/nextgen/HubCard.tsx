"use client";

import Link from "next/link";
import { ComingSoonBadge } from "@/components/StatusBadge";
import { useNavV2 } from "@/components/nextgen/ProfileChip";

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
  // SOTTOPAGINE V2 (15/10/2026): con la nuova barra stesse righe del Profilo
  // V2 (card con bordo sottile, icona su tinta neutra, testi più leggibili).
  const navV2 = useNavV2();
  if (navV2) {
    const row = (
      <div
        className={`flex min-h-[64px] items-center gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3 ${comingSoon ? "opacity-60" : ""} ${
          clickable ? "active:bg-black/[0.03]" : ""
        }`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-trama-primary-soft text-[19px] text-trama-primary">
          <i className={`ti ${icon}`} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            {title}
            {comingSoon && <ComingSoonBadge />}
          </span>
          {subtitle && <span className="text-[13px] text-ink-2">{subtitle}</span>}
        </span>
        {comingSoon ? null : badge !== undefined && badge > 0 ? (
          <span className="flex-shrink-0 rounded-full bg-[#F66B5E] px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>
        ) : (
          <i className="ti ti-chevron-right flex-shrink-0 text-[18px] text-ink-3" aria-hidden="true" />
        )}
      </div>
    );
    return href && !comingSoon ? <Link href={href}>{row}</Link> : row;
  }
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
