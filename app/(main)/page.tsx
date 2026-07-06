import Link from "next/link";
import ActivityCard from "@/components/ActivityCard";
import CategoryChip from "@/components/CategoryChip";
import { activities, categories } from "@/lib/mock-data";

export default function HomePage() {
  const popular = activities.slice(0, 2);
  const recommended = activities.slice(2, 3);

  return (
    <div className="animate-fade-in">
      <div
        className="px-5 pb-5 pt-4"
        style={{
          background: "linear-gradient(135deg,#E8F6FD 0%,#E3F9F5 100%)",
        }}
      >
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Ciao, Sofia! 👋</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Cosa facciamo questa estate?
            </p>
          </div>
          <div className="relative flex h-[42px] w-[42px] items-center justify-center rounded-full bg-orange-mid text-[15px] font-bold text-orange">
            SF
            <div className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#FF6B6B]" />
          </div>
        </div>
        <Link
          href="/search"
          className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.07)]"
        >
          <i className="ti ti-search text-lg text-ink-3" />
          <span className="text-sm text-ink-3">Cerca attività...</span>
          <div className="ml-auto flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-light px-2.5 py-1 text-xs font-medium text-sky">
            <i className="ti ti-map-pin text-[11px]" />
            Milano
          </div>
        </Link>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">Categorie</span>
          <span className="cursor-pointer text-[13px] font-medium text-sky">Tutte</span>
        </div>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {categories.map((cat, i) => (
            <CategoryChip
              key={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              bg={cat.bg}
              selected={i === 0}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">🔥 Popolari vicino a te</span>
          <span className="cursor-pointer text-[13px] font-medium text-sky">Vedi tutti</span>
        </div>
        {popular.map((a) => (
          <ActivityCard key={a.id} activity={a} />
        ))}

        <div className="mb-3 mt-1 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">⭐ Consigliati per Marco</span>
          <span className="cursor-pointer text-[13px] font-medium text-sky">Vedi tutti</span>
        </div>
        {recommended.map((a) => (
          <ActivityCard key={a.id} activity={a} />
        ))}
      </div>

      <div className="mx-5 mt-3.5 flex cursor-pointer items-center justify-between rounded-lg bg-sky-light px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <i className="ti ti-map text-[26px] text-sky" />
          <div>
            <p className="text-sm font-semibold text-ink">Attività sulla mappa</p>
            <p className="text-xs text-ink-2">24 centri nel raggio di 5 km</p>
          </div>
        </div>
        <button className="rounded-sm bg-sky px-3.5 py-2 text-xs font-semibold text-white">
          Vedi mappa
        </button>
      </div>
      <div className="h-5" />
    </div>
  );
}
