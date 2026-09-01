"use client";

import { useState } from "react";
import AddKidForm from "@/components/AddKidForm";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { Kid, KidGender } from "@/lib/types";
import { categories as interestOptions } from "@/lib/mock-data";
import { updateKidInterestsAction, updateKidAvatarAction, updateKidAction } from "@/app/actions/kids";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Duplicata volutamente da lib/data/kids.ts#ageFromBirthDate (stesso
// principio già usato per KIDS_AVATARS_BUCKET in app/actions/kids.ts):
// lib/data/kids.ts importa lib/supabase/server (next/headers), un
// componente "use client" non può attraversare quel confine — vedi anche
// lib/nextgen/responsibility-options.ts per lo stesso motivo.
function ageFromBirthDate(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00Z");
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

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
  // FEATURE (01/09/2026, richiesta di Fabrizio: "deve essere possibile
  // modificare caratteristiche figlio, tra cui età perché magari c'è un
  // errore") — bozza locale nome/data di nascita/genere per il bambino in
  // modifica, inizializzata quando si apre il pannello (vedi startEditing).
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<KidGender | "">("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  function startEditing(kid: Kid) {
    if (editingKidId === kid.id) {
      setEditingKidId(null);
      return;
    }
    setEditingKidId(kid.id);
    setEditName(kid.name);
    setEditBirthDate(kid.birthDate ?? "");
    setEditGender(kid.gender ?? "");
    setDetailsError(null);
  }

  async function saveDetails(kidId: string) {
    setDetailsError(null);
    if (!editName.trim()) {
      setDetailsError("Inserisci un nome");
      return;
    }
    if (!editBirthDate) {
      setDetailsError("Inserisci la data di nascita");
      return;
    }
    setSavingDetails(true);
    const result = isSupabaseConfigured
      ? await updateKidAction(kidId, editName, editBirthDate, editGender || undefined)
      : {};
    setSavingDetails(false);
    if (result.error) {
      setDetailsError(result.error);
      return;
    }
    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              name: editName.trim(),
              birthDate: editBirthDate,
              age: ageFromBirthDate(editBirthDate),
              gender: editGender || undefined,
            }
          : k
      )
    );
  }

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
            <div onClick={() => startEditing(k)} className="flex flex-1 cursor-pointer items-center gap-3">
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
              {/* FEATURE (01/09/2026, richiesta di Fabrizio: "deve essere
                  possibile modificare caratteristiche figlio, tra cui età
                  perché magari c'è un errore") — stessi campi di
                  AddKidForm.tsx, ora modificabili anche dopo la creazione. */}
              <div className="mb-2.5 grid grid-cols-2 gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome"
                  className="col-span-2 rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
                />
                <label className="text-[11px] text-ink-2">
                  Data di nascita
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
                  />
                </label>
                <label className="text-[11px] text-ink-2">
                  Genere (opzionale)
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as KidGender | "")}
                    className="mt-1 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
                  >
                    <option value="">Preferisco non dire</option>
                    <option value="F">Femmina</option>
                    <option value="M">Maschio</option>
                    <option value="altro">Altro</option>
                  </select>
                </label>
              </div>
              {detailsError && <p className="mb-2 text-xs font-medium text-orange">{detailsError}</p>}
              <button
                type="button"
                onClick={() => saveDetails(k.id)}
                disabled={savingDetails}
                className={`mb-3 rounded-md ${accentBg} px-4 py-2 text-xs font-bold text-white disabled:opacity-60`}
              >
                {savingDetails ? "Salvo…" : "Salva dati"}
              </button>

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
