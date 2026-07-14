"use client";

import { useState } from "react";
import AddKidForm from "@/components/AddKidForm";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { Kid } from "@/lib/types";
import { categories as interestOptions } from "@/lib/mock-data";
import { updateKidInterestsAction, updateKidAvatarAction } from "@/app/actions/kids";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function ProfileKidsSection({
  initialKids,
  autoOpenAddKid,
  accent = "sky",
}: {
  initialKids: Kid[];
  autoOpenAddKid?: boolean;
  // SPRINT 6 (NEXTGEN) — stesso opt-in di ProfileHeaderClient.tsx: viola
  // trama-violet per il Profilo NEXTGEN, default "sky" invariato per LEGACY.
  accent?: "sky" | "violet";
}) {
  const accentText = accent === "violet" ? "text-trama-violet" : "text-sky";
  const accentActive = accent === "violet" ? "border-trama-violet bg-trama-violet text-white" : "border-sky bg-sky text-white";
  const accentBg = accent === "violet" ? "bg-trama-violet" : "bg-sky";
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [showAddKid, setShowAddKid] = useState(Boolean(autoOpenAddKid));
  const [editingKidId, setEditingKidId] = useState<string | null>(null);
  const [savingInterests, setSavingInterests] = useState(false);

  async function handleAvatarUploaded(kidId: string, url: string) {
    setKids((prev) => prev.map((k) => (k.id === kidId ? { ...k, avatarUrl: url } : k)));
    if (isSupabaseConfigured) {
      await updateKidAvatarAction(kidId, url);
    }
  }

  function toggleInterestFor(kidId: string, value: string) {
    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              interests: (k.interests ?? []).includes(value)
                ? (k.interests ?? []).filter((i) => i !== value)
                : [...(k.interests ?? []), value],
            }
          : k
      )
    );
  }

  async function saveInterests(kidId: string) {
    const kid = kids.find((k) => k.id === kidId);
    if (!kid) return;
    setSavingInterests(true);
    if (isSupabaseConfigured) {
      await updateKidInterestsAction(kidId, kid.interests ?? []);
    }
    setSavingInterests(false);
    setEditingKidId(null);
  }

  return (
    <div className="px-5 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-bold text-ink">I miei bambini</span>
        {!showAddKid && (
          <span
            onClick={() => setShowAddKid(true)}
            className={`cursor-pointer text-[13px] font-medium ${accentText}`}
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
          className="mb-2.5 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <AvatarUploadButton
                folder="kids"
                currentUrl={k.avatarUrl}
                onUploaded={(url) => handleAvatarUploaded(k.id, url)}
                size={50}
                fallback={
                  <div
                    className="flex h-full w-full items-center justify-center text-2xl"
                    style={{ background: k.color }}
                  >
                    {k.emoji}
                  </div>
                }
              />
            </div>
            <div
              onClick={() => setEditingKidId((prev) => (prev === k.id ? null : k.id))}
              className="flex flex-1 cursor-pointer items-center gap-3"
            >
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">{k.name}</div>
              <div className="mb-1 text-xs text-ink-2">
                {k.age} anni{k.grade ? ` · ${k.grade}` : ""}
              </div>
              {k.interests && k.interests.length > 0 ? (
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
              ) : (
                <span className={`text-[11px] font-medium ${accentText}`}>+ Aggiungi interessi</span>
              )}
            </div>
            <i className={`ti ${editingKidId === k.id ? "ti-chevron-up" : "ti-chevron-down"} text-lg text-ink-3`} />
            </div>
          </div>

          {editingKidId === k.id && (
            <div className="mt-3 border-t border-[#F0F2F5] pt-3">
              <div className="mb-1.5 text-[11px] text-ink-2">
                Interessi — usati per suggerire le attività più adatte in Home
              </div>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {interestOptions.map((c) => {
                  const value = `${c.emoji} ${c.label}`;
                  const active = (k.interests ?? []).includes(value);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleInterestFor(k.id, value)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active ? accentActive : "border-[#E8EBF0] bg-white text-ink-2"
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => saveInterests(k.id)}
                disabled={savingInterests}
                className={`rounded-md ${accentBg} px-4 py-2 text-xs font-bold text-white disabled:opacity-60`}
              >
                {savingInterests ? "Salvo…" : "Salva"}
              </button>
            </div>
          )}
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
