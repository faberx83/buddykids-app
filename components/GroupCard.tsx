import Link from "next/link";
import { GroupItem } from "@/lib/types";
import { pillClasses } from "@/lib/colors";
import ActivityVisual from "@/components/nextgen/ActivityVisual";

// TRAMA ONE (24/08/2026) — basePath opzionale (default "/groups") per essere
// riusato anche dal guscio NEXTGEN-native app/nextgen/groups, che deve
// restare dentro le proprie route invece di rimandare al layout LEGACY.
// nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" in Gruppi):
// il pill "Apri gruppo" era hardcoded sky/sky-light — stesso trattamento
// già dato a GroupDetailClient/CoverageStrip. Legacy (default false) resta
// invariato.
export default function GroupCard({
  group,
  basePath = "/groups",
  nextgen = false,
  detailQuery = "",
}: {
  group: GroupItem;
  basePath?: string;
  /** "v2" (GROUPS_V2_ENABLED, 14/10/2026): card 20px con ombra leggera, testi più grandi. */
  nextgen?: boolean | "v2";
  // TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 4-5) —
  // suffisso query string opzionale (es. "?from=planner-gruppi") propagato
  // da GroupsClient quando la lista è stata raggiunta da Planner/Gruppi, cosi
  // il Back dal dettaglio torni lì e non alla lista "nuda". Assente:
  // comportamento INVARIATO (href identico a prima).
  detailQuery?: string;
}) {
  const accentBg = nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  const v2 = nextgen === "v2";
  return (
    <Link
      href={`${basePath}/${group.id}${detailQuery}`}
      className={
        v2
          ? "mx-5 mb-3 block overflow-hidden rounded-2xl border border-trama-line bg-white active:scale-[0.99]"
          : "mx-5 mb-3 block cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.98]"
      }
    >
      {v2 ? (
        // POLISH V2 (14/10/2026): monogramma + filo TRAMA al posto dell'emoji grande.
        <ActivityVisual title={group.name} className="h-[72px]">
          {group.discountLabel.startsWith("Sconto") && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#146B4F]">
              {group.discountLabel.replace("Sconto ", "-")}
            </span>
          )}
        </ActivityVisual>
      ) : (
      <div
        className="relative flex h-[84px] items-center justify-center text-[44px]"
        style={{ background: group.gradient }}
      >
        <span>{group.emoji}</span>
        <div className="absolute right-2.5 top-2.5 rounded-full bg-green-light px-2.5 py-0.5 text-[10px] font-bold text-[#2d8f52]">
          {group.discountLabel.startsWith("Sconto") ? group.discountLabel.replace("Sconto ", "-") : ""}
        </div>
      </div>
      )}
      <div className={v2 ? "px-4 pb-[15px] pt-[13px]" : "p-3"}>
        <div className={v2 ? "mb-1 text-[16px] font-semibold text-ink" : "mb-1 text-sm font-bold text-ink"}>{group.name}</div>
        <div className={`mb-2.5 flex items-center gap-1.5 text-ink-2 ${v2 ? "text-[13px]" : "text-xs"}`}>
          <i className="ti ti-map-pin" />
          {group.location}
          {group.dateRange ? ` · ${group.dateRange}` : ""}
        </div>
        <div className="mb-2.5 flex items-center">
          {group.members.map((m, i) => (
            <div
              key={i}
              className="mr-[-8px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold"
              style={{ background: m.bg, color: m.color }}
            >
              {m.initials}
            </div>
          ))}
          {group.extraMembers && (
            <div className="mr-[-8px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-light text-[10px] font-bold text-[#6b58d4]">
              +{group.extraMembers}
            </div>
          )}
          <span className="ml-[18px] text-[11px] font-medium text-ink-2">
            {group.totalFamilies} famiglie {group.extraMembers ? "iscritte" : ""}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pillClasses[group.discountBadgeColor]}`}
          >
            <i className={`ti ${group.discountBadgeColor === "green" ? "ti-tag" : "ti-users"} text-xs`} />
            {group.discountLabel}
          </div>
          <span
            className={
              v2
                ? "flex min-h-[44px] items-center gap-1 rounded-[12px] bg-trama-primary px-4 text-[13.5px] font-bold text-white"
                : `flex items-center gap-1 rounded-md ${accentBg} px-3.5 py-1.5 text-xs font-semibold ${accentText}`
            }
          >
            Apri gruppo
            <i className="ti ti-chevron-right text-xs" />
          </span>
        </div>
      </div>
    </Link>
  );
}
