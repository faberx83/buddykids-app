import { GroupItem } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function GroupCard({ group }: { group: GroupItem }) {
  return (
    <div className="mx-5 mb-3 cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.98]">
      <div
        className="relative flex h-[84px] items-center justify-center text-[44px]"
        style={{ background: group.gradient }}
      >
        <span>{group.emoji}</span>
        <div className="absolute right-2.5 top-2.5 rounded-full bg-green-light px-2.5 py-0.5 text-[10px] font-bold text-[#2d8f52]">
          {group.discountLabel.startsWith("Sconto") ? group.discountLabel.replace("Sconto ", "-") : ""}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-1 text-sm font-bold text-ink">{group.name}</div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs text-ink-2">
          <i className="ti ti-map-pin" />
          {group.location} · {group.dateRange}
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
          <button className="rounded-md bg-sky-light px-3.5 py-1.5 text-xs font-semibold text-sky">
            Invita
          </button>
        </div>
      </div>
    </div>
  );
}
