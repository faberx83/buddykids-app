"use client";

import { useState } from "react";
import AddKidForm from "@/components/AddKidForm";
import { Kid } from "@/lib/types";

export default function ProfileKidsSection({ initialKids }: { initialKids: Kid[] }) {
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [showAddKid, setShowAddKid] = useState(false);

  return (
    <div className="px-5 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-bold text-ink">I miei bambini</span>
        {!showAddKid && (
          <span
            onClick={() => setShowAddKid(true)}
            className="cursor-pointer text-[13px] font-medium text-sky"
          >
            + Aggiungi
          </span>
        )}
      </div>

      {kids.length === 0 && !showAddKid && (
        <p className="mb-2.5 text-xs text-ink-2">
          Non hai ancora aggiunto nessun bambino.
        </p>
      )}

      {kids.map((k) => (
        <div
          key={k.id}
          className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-all hover:scale-[0.98] hover:shadow-md"
        >
          <div
            className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ background: k.color }}
          >
            {k.emoji}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-ink">{k.name}</div>
            <div className="mb-1 text-xs text-ink-2">
              {k.age} anni{k.grade ? ` · ${k.grade}` : ""}
            </div>
            {k.interests && k.interests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {k.interests.map((int) => (
                  <span
                    key={int}
                    className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-2"
                  >
                    {int}
                  </span>
                ))}
              </div>
            )}
          </div>
          <i className="ti ti-chevron-right text-lg text-ink-3" />
        </div>
      ))}

      {showAddKid && (
        <AddKidForm
          onAdded={(kid) => {
            setKids((prev) => [...prev, kid]);
            setShowAddKid(false);
          }}
          onCancel={() => setShowAddKid(false)}
        />
      )}
    </div>
  );
}
