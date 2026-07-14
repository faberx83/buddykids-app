"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommunityDetail, CommunityRole } from "@/lib/types";
import { Activity } from "@/lib/types";
import {
  proposeActivityAction,
  expressInterestAction,
  withdrawInterestAction,
  spawnGroupFromProposalAction,
} from "@/app/actions/communities";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

// SPRINT 4 (NEXTGEN) — Dettaglio Community. Sezioni: membri/ruoli, "Le
// attività della community" (le proposte, con interesse/voto e famiglie già
// iscritte), e la generazione di un Gruppo sconto vero e proprio da una
// proposta matura (relazione richiesta con i "Gruppi" esistenti).

const ROLE_LABEL: Record<CommunityRole, string> = {
  creatore: "Creatore",
  admin: "Admin",
  membro: "Membro",
};

export default function CommunityDetailClient({
  detail,
  activities,
}: {
  detail: CommunityDetail;
  activities: Activity[];
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [proposals, setProposals] = useState(detail.proposals);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [note, setNote] = useState("");
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [busyPropose, setBusyPropose] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = detail.myRole === "creatore" || detail.myRole === "admin";
  const bookableActivities = useMemo(() => activities.filter((a) => a.dbId), [activities]);

  async function handlePropose() {
    if (!selectedActivityId) {
      setError("Scegli un'attività da proporre");
      return;
    }
    setBusyPropose(true);
    setError(null);
    const res = await proposeActivityAction(detail.id, selectedActivityId, note);
    setBusyPropose(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast("Proposta condivisa con la community!");
    setShowProposeForm(false);
    setSelectedActivityId("");
    setNote("");
    router.refresh();
  }

  async function toggleInterest(proposalId: string, currentlyInterested: boolean) {
    setBusyProposalId(proposalId);
    const action = currentlyInterested ? withdrawInterestAction : expressInterestAction;
    const res = await action(proposalId, detail.id);
    setBusyProposalId(null);
    if (res.error) return;
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? { ...p, iAmInterested: !currentlyInterested, interestCount: p.interestCount + (currentlyInterested ? -1 : 1) }
          : p
      )
    );
  }

  async function handleSpawnGroup(proposalId: string) {
    setBusyProposalId(proposalId);
    const res = await spawnGroupFromProposalAction(proposalId, detail.id);
    setBusyProposalId(null);
    if (res.error) return;
    showToast("Gruppo creato! Ora potete inviare la Richiesta Gruppo al centro.");
  }

  function copyCode() {
    navigator.clipboard?.writeText(detail.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-bg text-3xl">
          {detail.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-ink">{detail.name}</h1>
          {detail.description && <p className="truncate text-[13px] text-ink-3">{detail.description}</p>}
        </div>
      </div>

      {/* Invito — link o codice, come richiesto ("invito tramite link o QR";
          il codice testuale è la base condivisibile anche via QR in futuro). */}
      <button
        type="button"
        onClick={copyCode}
        className="nextgen-warm-shadow flex items-center justify-between rounded-[20px] bg-white p-4 text-left"
      >
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Codice invito</div>
          <div className="text-lg font-bold tracking-wide text-ink">{detail.inviteCode}</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-[12px] font-bold text-ink-2">
          <i className={`ti ${copied ? "ti-check text-green" : "ti-copy"}`} />
          {copied ? "Copiato" : "Copia"}
        </span>
      </button>

      {/* Membri */}
      <div>
        <div className="mb-3 text-[21px] font-semibold text-ink">Famiglie ({detail.members.length})</div>
        <div className="flex flex-col gap-2">
          {detail.members.map((m) => (
            <div key={m.parentId} className="flex items-center justify-between rounded-2xl bg-bg px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">{m.label}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{ROLE_LABEL[m.role]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Le attività della community */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[21px] font-semibold text-ink">Le attività della community</div>
          <button
            type="button"
            onClick={() => setShowProposeForm((v) => !v)}
            className="text-sm font-semibold text-trama-violet"
          >
            <i className="ti ti-plus mr-1" />
            Proponi
          </button>
        </div>

        {showProposeForm && (
          <div className="nextgen-warm-shadow mb-3 flex flex-col gap-3 rounded-[20px] bg-white p-4">
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="rounded-xl border border-[#E8EBF0] px-3.5 py-2.5 text-sm"
            >
              <option value="">Scegli un&apos;attività…</option>
              {bookableActivities.map((a) => (
                <option key={a.dbId} value={a.dbId}>
                  {a.name} — {a.center}
                </option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Perché la proponi? (opzionale)"
              rows={2}
              className="resize-none rounded-xl border border-[#E8EBF0] px-3.5 py-2.5 text-sm"
            />
            {error && <div className="text-[13px] font-medium text-red-500">{error}</div>}
            <button
              type="button"
              disabled={busyPropose}
              onClick={handlePropose}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busyPropose ? "Invio…" : "Condividi proposta"}
            </button>
          </div>
        )}

        {proposals.length === 0 ? (
          <div className="rounded-[20px] bg-bg p-5 text-center text-sm text-ink-2">
            Ancora nessuna proposta. Suggerisci un&apos;attività da fare insieme.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {proposals.map((p) => (
              <div key={p.id} className="nextgen-warm-shadow rounded-[20px] bg-white p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: p.activityGradient }}
                  >
                    {p.activityEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/activity/${p.activitySlug}`} className="block truncate text-base font-semibold text-ink">
                      {p.activityName}
                    </Link>
                    <div className="truncate text-[12.5px] text-ink-3">{p.centerName}</div>
                    {p.note && <div className="mt-1 text-[13px] text-ink-2">{p.note}</div>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyProposalId === p.id}
                    onClick={() => toggleInterest(p.id, p.iAmInterested)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50 ${
                      p.iAmInterested ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    <i className={`ti ${p.iAmInterested ? "ti-heart-filled" : "ti-heart"} text-[14px]`} />
                    {p.iAmInterested ? "Interessato" : "Mi interessa"} · {p.interestCount}
                  </button>
                  {p.alreadyEnrolledCount > 0 && (
                    <span className="rounded-full bg-[#E8F9EE] px-3 py-1.5 text-[12px] font-bold text-[#2d8f52]">
                      {p.alreadyEnrolledCount} {p.alreadyEnrolledCount === 1 ? "famiglia già iscritta" : "famiglie già iscritte"}
                    </span>
                  )}
                  {canManage && p.interestCount > 0 && (
                    <button
                      type="button"
                      disabled={busyProposalId === p.id}
                      onClick={() => handleSpawnGroup(p.id)}
                      className="ml-auto flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      <i className="ti ti-users-group text-[13px]" />
                      Genera Gruppo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
