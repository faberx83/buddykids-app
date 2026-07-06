"use client";

import { useState } from "react";
import GroupCard from "@/components/GroupCard";
import { groups } from "@/lib/mock-data";

const tabs = ["I miei gruppi", "Scopri", "Inviti (2)"];

export default function GroupsPage() {
  const [active, setActive] = useState(0);

  return (
    <div className="animate-fade-in">
      <div className="flex-shrink-0 border-b border-[#F0F2F5] bg-white px-5 py-3.5">
        <h2 className="mb-3 text-lg font-bold text-ink">Gruppi & Community</h2>
        <div className="flex rounded-lg bg-[#F4F6FA] p-[3px]">
          {tabs.map((t, i) => (
            <div
              key={t}
              onClick={() => setActive(i)}
              className={`flex-1 cursor-pointer rounded-md py-2 text-center text-xs font-medium transition-all ${
                active === i
                  ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                  : "text-ink-2"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      <div
        className="mx-5 my-3 flex items-center gap-3 rounded-lg p-3.5"
        style={{ background: "linear-gradient(120deg,#E8F6FD,#E3F9F5)" }}
      >
        <div className="text-[34px]">🤝</div>
        <div>
          <div className="text-sm font-bold text-ink">Andiamo Insieme</div>
          <div className="mt-0.5 text-xs text-ink-2">
            Crea un gruppo e ottieni sconti con gli amici
          </div>
        </div>
        <button className="ml-auto whitespace-nowrap rounded-md bg-sky px-3 py-2 text-xs font-bold text-white">
          + Nuovo
        </button>
      </div>

      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
      <div className="h-5" />
    </div>
  );
}
