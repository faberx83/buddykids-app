"use client";

import { useState } from "react";
import {
  adminReviewOnboardingAction,
  adminReviewIdentityVerificationAction,
} from "@/app/actions/onboarding";
import {
  ONBOARDING_STATUS_REGISTRY,
  getOnboardingStatusBadgeClassName,
} from "@/lib/onboarding/status-copy";
import type { CenterForReview, IdentityVerificationState, OnboardingAuditEntry } from "@/lib/onboarding/types";

interface CenterDetail {
  centerId: string;
  identity: IdentityVerificationState;
  auditLog: OnboardingAuditEntry[];
}

export default function AdminOnboardingReviewClient({
  initialCenters,
  initialDetails,
}: {
  initialCenters: CenterForReview[];
  initialDetails: CenterDetail[];
}) {
  const [centers, setCenters] = useState(initialCenters);
  const [details] = useState(new Map(initialDetails.map((d) => [d.centerId, d])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function review(centerId: string, decision: "approve" | "request_changes" | "suspend") {
    setBusyId(centerId);
    setError(null);
    const result = await adminReviewOnboardingAction(centerId, decision, noteDraft[centerId]);
    setBusyId(null);
    if (result.error) return setError(result.error);
    const targetStatus =
      decision === "approve" ? "APPROVED" : decision === "request_changes" ? "CHANGES_REQUESTED" : "SUSPENDED";
    setCenters((prev) => prev.map((c) => (c.centerId === centerId ? { ...c, status: targetStatus } : c)));
  }

  async function reviewIdentity(centerId: string, decision: "verified" | "rejected") {
    setBusyId(centerId);
    setError(null);
    const result = await adminReviewIdentityVerificationAction(centerId, decision);
    setBusyId(null);
    if (result.error) return setError(result.error);
    const detail = details.get(centerId);
    if (detail) detail.identity = { ...detail.identity, status: decision };
  }

  const submitted = centers.filter((c) => c.status === "SUBMITTED");
  const other = centers.filter((c) => c.status !== "SUBMITTED");

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Onboarding centri — TRAMA ONE</h1>
        <p className="text-sm text-navy-text2">
          Revisione delle richieste di onboarding dei centri per TRAMA ONE (Build Sprint 1). Un centro non in
          questa lista non ha ancora avviato il percorso (nessuna azione richiesta).
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#F5C6C6] bg-[#FBEAEA] p-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          In revisione ({submitted.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {submitted.map((c) => {
            const detail = details.get(c.centerId);
            return (
              <div key={c.centerId} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{c.centerName}</div>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getOnboardingStatusBadgeClassName(c.status)}`}>
                      {ONBOARDING_STATUS_REGISTRY[c.status].admin.label}
                    </span>
                  </div>
                  {detail && (
                    <div className="text-xs text-ink-2">
                      Identità: <span className="font-semibold">{detail.identity.status}</span>
                      {detail.identity.note && <span className="italic"> — &ldquo;{detail.identity.note}&rdquo;</span>}
                    </div>
                  )}
                </div>

                {detail && detail.identity.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => reviewIdentity(c.centerId, "verified")}
                      disabled={busyId === c.centerId}
                      className="rounded-md border border-[#E8EBF0] px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
                    >
                      Verifica identità
                    </button>
                    <button
                      onClick={() => reviewIdentity(c.centerId, "rejected")}
                      disabled={busyId === c.centerId}
                      className="rounded-md border border-[#E8EBF0] px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
                    >
                      Rifiuta identità
                    </button>
                  </div>
                )}

                <input
                  value={noteDraft[c.centerId] ?? ""}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, [c.centerId]: e.target.value }))}
                  placeholder="Nota facoltativa per la decisione"
                  className="mt-2 w-full max-w-sm rounded-md border border-[#E8EBF0] bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                />

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => review(c.centerId, "approve")}
                    disabled={busyId === c.centerId}
                    className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Approva
                  </button>
                  <button
                    onClick={() => review(c.centerId, "request_changes")}
                    disabled={busyId === c.centerId}
                    className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Richiedi modifiche
                  </button>
                </div>
              </div>
            );
          })}
          {submitted.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Nessuna richiesta in revisione al momento.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Altri stati ({other.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {other.map((c) => (
            <div key={c.centerId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="text-sm font-semibold text-ink">{c.centerName}</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOnboardingStatusBadgeClassName(c.status)}`}>
                  {ONBOARDING_STATUS_REGISTRY[c.status].admin.label}
                </span>
                {c.status === "APPROVED" && (
                  <button
                    onClick={() => review(c.centerId, "suspend")}
                    disabled={busyId === c.centerId}
                    className="rounded-md border border-[#E8EBF0] px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
                  >
                    {ONBOARDING_STATUS_REGISTRY.APPROVED.admin.primaryAction}
                  </button>
                )}
              </div>
            </div>
          ))}
          {other.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Nessun altro centro in coda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
