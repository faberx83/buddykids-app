import Link from "next/link";
import { Activity } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function ActivityCardHorizontal({
  activity,
}: {
  activity: Activity;
}) {
  return (
    <Link
      href={`/activity/${activity.id}`}
      className="mx-5 mb-3 flex h-[106px] cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.98] hover:shadow-md"
    >
      <div
        className="flex w-[106px] flex-shrink-0 items-center justify-center text-5xl"
        style={{ background: activity.imgGradient }}
      >
        {activity.emoji}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div className="text-[13px] font-bold text-ink">{activity.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <i className="ti ti-map-pin" />
          {activity.distanceKm} km · {activity.ageRange}
        </div>
        <div className="my-0.5 flex flex-wrap gap-1">
          {activity.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillClasses[tag.color]}`}
            >
              {tag.label.replace(/^\S+\s/, "")}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            €{activity.pricePerWeek}
            <span className="text-[10px] font-normal text-ink-2">/sett</span>
          </div>
          <div className="flex items-center gap-0.5 text-[11px] font-semibold text-ink">
            <i className="ti ti-star-filled text-yellow" />
            {activity.rating}
          </div>
        </div>
      </div>
    </Link>
  );
}
