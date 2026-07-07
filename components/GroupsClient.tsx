"use client";

import { useState } from "react";
import GroupCard from "@/components/GroupCard";
import { createGroupAction } from "@/app/actions/groups";
import { GroupItem } from "@/lib/types";

const tabs = ["I miei gruppi", "Scopri", "Inviti"];

export default function GroupsClient({ initialGroups }: { initialGroups: GroupItem[] }) {
  const [active, setActive] = useState(0);
  const [groups, setGroups] = useState<GroupItem[]>(initialGroups);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setError(null);
    setSaving(true);
    const result = await createGroupAction(newName);
    setSaving(false);
    if (result.error || !result.group) {
      setError(result.error || "Errore nella creazione");
      return;
    }
    setGroups((prev) => [result.group!, ...prev]);
    setNewName("");
    setShowNew(false);
  }

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

      {active === 0 && (
        <>
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
            {!showNew && (
              <button
                onClick={() => setShowNew(true)}
                className="ml-auto whitespace-nowrap rounded-md bg-sky px-3 py-2 text-xs font-bold text-white"
              >
                + Nuovo
              </button>
            )}
          </div>

          {showNew && (
            <div className="mx-5 mb-3 rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light/40 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome del gruppo"
                className="mb-2 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
              />
              {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Creo…" : "Crea gruppo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setError(null);
                  }}
                  className="rounded-md border border-[#E8EBF0] px-4 py-2 text-xs font-semibold text-ink"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showNew && (
            <p className="mx-5 mb-3 text-sm text-ink-2">
              Non fai ancora parte di nessun gruppo — creane uno per iniziare a risparmiare con gli
              amici.
            </p>
          )}

          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
          <div className="h-5" />
        </>
      )}

      {active === 1 && (
        <div className="px-5 py-8 text-center text-sm text-ink-2">
          Scopri gruppi pubblici — funzionalità in arrivo.
        </div>
      )}

      {active === 2 && (
        <div className="px-5 py-8 text-center text-sm text-ink-2">
          Inviti ricevuti — funzionalità in arrivo.
        </div>
      )}
    </div>
  );
}
