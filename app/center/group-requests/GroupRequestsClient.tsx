"use client";

import { useState } from "react";
import { GroupRequestItem } from "@/lib/types";
import { respondGroupRequestAction } from "@/app/actions/groups";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STATUS_LABEL: Record<GroupRequestItem["status"], { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-orange-light text-[#d4622a]" },
  accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

export default function GroupRequestsClient({
  initialRequests,
}: {
  initialRequests: GroupRequestItem[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    const result = await respondGroupRequestAction(id, accept);
    setBusyId(null);
    if (!result.error) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: accept ? "accepted" : "rejected" } : r))
      );
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Richieste Gruppo</h1>
        <p className="text-sm text-ink-2">
          Gruppi di famiglie che chiedono uno sconto proporzionale al numero di bambini iscritti —
          vedi lib/groups.ts per le fasce.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le richieste reali una volta
          collegato.
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          In attesa ({pending.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{r.groupName}</div>
                <div className="text-xs text-ink-2">
                  {r.activityName} · {r.kidsCount} bambini · sconto richiesto {r.discountPercent}%
                </div>
                {r.message && <div className="mt-1 text-xs italic text-ink-2">&quot;{r.message}&quot;</div>}
              </div>
              <button
                onClick={() => respond(r.id, true)}
                disabled={busyId === r.id}
                className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                Accetta
              </button>
              <button
                onClick={() => respond(r.id, false)}
                disabled={busyId === r.id}
                className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                Rifiuta
              </button>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna richiesta in attesa al momento.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Storico ({resolved.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {resolved.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{r.groupName}</div>
                <div className="text-xs text-ink-2">
                  {r.activityName} · {r.kidsCount} bambini · sconto {r.discountPercent}%
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[r.status].cls}`}>
                {STATUS_LABEL[r.status].label}
              </span>
            </div>
          ))}
          {resolved.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Ancora nessuna richiesta risolta.</p>
          )}
        </div>
      </div>
    </div>
  );
}
