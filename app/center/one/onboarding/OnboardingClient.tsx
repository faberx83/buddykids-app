"use client";

import { useState } from "react";
import Link from "next/link";
import {
  claimOnboardingAction,
  submitOnboardingAction,
  toggleChecklistItemAction,
  submitIdentityVerificationAction,
} from "@/app/actions/onboarding";
import { ONBOARDING_CHECKLIST_REGISTRY, isRequiredChecklistComplete } from "@/lib/onboarding/checklist-registry";
import {
  ONBOARDING_STATUS_REGISTRY,
  getOnboardingStatusBadgeClassName,
  getSubmitCta,
  formatOnboardingTransition,
} from "@/lib/onboarding/status-copy";
import type {
  CenterOnboardingState,
  ChecklistItemState,
  IdentityVerificationState,
  OnboardingAuditEntry,
} from "@/lib/onboarding/types";

const IDENTITY_LABEL: Record<IdentityVerificationState["status"], { label: string; cls: string }> = {
  not_started: { label: "Non inviata", cls: "bg-[#F0F2F5] text-ink-2" },
  pending: { label: "In attesa di revisione", cls: "bg-orange-light text-trama-orange" },
  verified: { label: "Verificata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

export default function OnboardingClient({
  centerId,
  initialState,
  initialChecklist,
  initialIdentity,
  auditLog,
}: {
  centerId: string | null;
  initialState: CenterOnboardingState;
  initialChecklist: ChecklistItemState[];
  initialIdentity: IdentityVerificationState;
  auditLog: OnboardingAuditEntry[];
}) {
  const [state, setState] = useState(initialState);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [identity, setIdentity] = useState(initialIdentity);
  const [identityNote, setIdentityNote] = useState(initialIdentity.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!centerId) {
    return (
      <div className="rounded-lg border border-[#E8EBF0] bg-white p-5 text-sm text-ink-2">
        Nessun centro collegato a questo account (modalità demo o profilo incompleto). L&apos;onboarding
        TRAMA ONE richiede un centro reale collegato al profilo.
      </div>
    );
  }

  async function handleClaim() {
    setBusy(true);
    setError(null);
    const result = await claimOnboardingAction(centerId!);
    setBusy(false);
    if (result.error) return setError(result.error);
    setState((s) => ({ ...s, status: "CLAIMED" }));
  }

  async function handleToggleChecklist(itemKey: string, completed: boolean) {
    setChecklist((prev) => prev.map((i) => (i.itemKey === itemKey ? { ...i, completed } : i)));
    const result = await toggleChecklistItemAction(centerId!, itemKey, completed);
    if (result.error) {
      setError(result.error);
      setChecklist((prev) => prev.map((i) => (i.itemKey === itemKey ? { ...i, completed: !completed } : i)));
    }
  }

  async function handleSubmitIdentity() {
    setBusy(true);
    setError(null);
    const result = await submitIdentityVerificationAction(centerId!, identityNote);
    setBusy(false);
    if (result.error) return setError(result.error);
    setIdentity((i) => ({ ...i, status: "pending", note: identityNote }));
  }

  async function handleSubmitOnboarding() {
    setBusy(true);
    setError(null);
    const result = await submitOnboardingAction(centerId!);
    setBusy(false);
    if (result.error) return setError(result.error);
    setState((s) => ({ ...s, status: "SUBMITTED" }));
  }

  const requiredComplete = isRequiredChecklistComplete(checklist);
  const canSubmit = (state.status === "CLAIMED" || state.status === "CHANGES_REQUESTED") && requiredComplete;

  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Attivazione centro — TRAMA ONE</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOnboardingStatusBadgeClassName(state.status)}`}>
          {ONBOARDING_STATUS_REGISTRY[state.status].partner.label}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#F5C6C6] bg-[#FBEAEA] p-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {state.status === "LEAD" && (
        <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <p className="mb-3 text-sm text-ink-2">{ONBOARDING_STATUS_REGISTRY.LEAD.partner.description}</p>
          <button
            onClick={handleClaim}
            disabled={busy}
            className="rounded-md bg-partner px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {ONBOARDING_STATUS_REGISTRY.LEAD.partner.primaryAction}
          </button>
        </div>
      )}

      {(state.status === "CLAIMED" || state.status === "SUBMITTED" || state.status === "CHANGES_REQUESTED") && (
        <>
          <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
            <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Checklist</div>
            <div className="divide-y divide-[#F0F2F5]">
              {ONBOARDING_CHECKLIST_REGISTRY.map((item) => {
                const current = checklist.find((c) => c.itemKey === item.key);
                return (
                  <label key={item.key} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={current?.completed ?? false}
                      disabled={state.status === "SUBMITTED"}
                      onChange={(e) => handleToggleChecklist(item.key, e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {item.label} {item.required && <span className="text-[#C0392B]">*</span>}
                      </div>
                      <div className="text-xs text-ink-2">{item.description}</div>
                      {item.key === "profile_complete" && (
                        <Link href="/center/profile" className="mt-1 inline-block text-xs font-semibold text-sky">
                          Vai al profilo centro →
                        </Link>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Verifica identità</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${IDENTITY_LABEL[identity.status].cls}`}>
                {IDENTITY_LABEL[identity.status].label}
              </span>
            </div>
            <p className="mb-2 text-xs text-ink-2">
              Indica nome e ruolo del referente e come l&apos;Admin può verificare la tua identità (es. numero di
              telefono già noto, riferimento ad accordo commerciale esistente).
            </p>
            <textarea
              value={identityNote}
              onChange={(e) => setIdentityNote(e.target.value)}
              disabled={identity.status === "verified" || identity.status === "rejected"}
              rows={3}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky disabled:opacity-60"
              placeholder="Nota per l'Admin..."
            />
            {identity.status !== "verified" && identity.status !== "rejected" && (
              <button
                onClick={handleSubmitIdentity}
                disabled={busy || !identityNote.trim()}
                className="mt-2 rounded-md border border-[#E8EBF0] px-3.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {identity.status === "pending" ? "Aggiorna nota" : "Invia per verifica"}
              </button>
            )}
          </div>

          {state.status === "CHANGES_REQUESTED" && (
            <div className="mb-5 rounded-lg border border-[#F5C6C6] bg-[#FBEAEA] p-4 text-sm text-[#C0392B]">
              {ONBOARDING_STATUS_REGISTRY.CHANGES_REQUESTED.partner.description} Controlla lo storico qui sotto
              per il dettaglio, poi invia di nuovo.
            </div>
          )}

          {state.status !== "SUBMITTED" && (
            <button
              onClick={handleSubmitOnboarding}
              disabled={busy || !canSubmit}
              className="rounded-md bg-partner px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              title={!requiredComplete ? "Completa gli elementi obbligatori (*) della checklist" : undefined}
            >
              {getSubmitCta(state.status)}
            </button>
          )}
          {state.status === "SUBMITTED" && (
            <div className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
              {ONBOARDING_STATUS_REGISTRY.SUBMITTED.partner.waitingState}.
            </div>
          )}
        </>
      )}

      {state.status === "APPROVED" && (
        <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <p className="text-sm text-ink-2">
            {ONBOARDING_STATUS_REGISTRY.APPROVED.partner.description} Le funzionalità successive (catalogo,
            Giorni spot) arrivano nei prossimi sprint.
          </p>
        </div>
      )}

      {state.status === "SUSPENDED" && (
        <div className="mb-5 rounded-lg border border-[#F5C6C6] bg-[#FBEAEA] p-5 text-sm text-[#C0392B]">
          {ONBOARDING_STATUS_REGISTRY.SUSPENDED.partner.description}
        </div>
      )}

      {auditLog.length > 0 && (
        <div className="mt-6 rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Storico</div>
          <div className="divide-y divide-[#F0F2F5]">
            {auditLog.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 text-xs text-ink-2">
                <span className="font-semibold text-ink">
                  {formatOnboardingTransition(entry.fromStatus, entry.toStatus, "partner")}
                </span>{" "}
                — {new Date(entry.createdAt).toLocaleString("it-IT")}
                {entry.note && <div className="mt-0.5 italic">&ldquo;{entry.note}&rdquo;</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
