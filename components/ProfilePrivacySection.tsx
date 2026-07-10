"use client";

import { useState } from "react";
import type { AccountStatus } from "@/lib/data/profile";
import {
  updateMarketingConsentAction,
  deactivateAccountAction,
  requestAccountDeletionAction,
} from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Sezione "Privacy e account" — consenso marketing/cookie, disattivazione
// temporanea e richiesta di cancellazione definitiva (diritto all'oblio).
// La cancellazione vera e propria richiede intervento manuale di un
// platform_admin (vedi commento in app/actions/profile.ts): qui l'utente può
// solo INOLTRARE la richiesta, che viene marcata sul proprio profilo.
export default function ProfilePrivacySection({
  initialMarketingConsent,
  initialAccountStatus,
  onAfterAccountAction,
}: {
  initialMarketingConsent: boolean;
  initialAccountStatus: AccountStatus;
  onAfterAccountAction?: () => void;
}) {
  const [marketingConsent, setMarketingConsent] = useState(initialMarketingConsent);
  const [accountStatus, setAccountStatus] = useState(initialAccountStatus);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConsentChange(value: boolean) {
    setMarketingConsent(value);
    if (!isSupabaseConfigured) return;
    const result = await updateMarketingConsentAction(value);
    if (result.error) setError(result.error);
  }

  async function handleDeactivate() {
    setError(null);
    if (!isSupabaseConfigured) {
      setAccountStatus("deactivated");
      setConfirmingDeactivate(false);
      return;
    }
    setBusy(true);
    const result = await deactivateAccountAction();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAccountStatus("deactivated");
    setConfirmingDeactivate(false);
    onAfterAccountAction?.();
  }

  async function handleRequestDeletion() {
    setError(null);
    if (!isSupabaseConfigured) {
      setAccountStatus("deletion_requested");
      setConfirmingDelete(false);
      return;
    }
    setBusy(true);
    const result = await requestAccountDeletionAction();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAccountStatus("deletion_requested");
    setConfirmingDelete(false);
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <label className="mb-3 flex items-center justify-between text-sm text-ink">
        <span>Consenso a comunicazioni marketing</span>
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => handleConsentChange(e.target.checked)}
          className="h-4 w-4 accent-sky"
        />
      </label>

      {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}

      {accountStatus === "deactivated" && (
        <p className="mb-2 text-xs font-medium text-ink-2">
          Account disattivato. Contatta l&apos;assistenza per riattivarlo.
        </p>
      )}
      {accountStatus === "deletion_requested" && (
        <p className="mb-2 text-xs font-medium text-ink-2">
          Richiesta di cancellazione inviata: verrà elaborata a breve.
        </p>
      )}

      {accountStatus === "active" && (
        <div className="flex flex-col gap-2 border-t border-[#E8EBF0] pt-3">
          {!confirmingDeactivate ? (
            <button
              type="button"
              onClick={() => setConfirmingDeactivate(true)}
              className="rounded-md border border-[#E8EBF0] px-4 py-2 text-xs font-semibold text-ink"
            >
              Disattiva account temporaneamente
            </button>
          ) : (
            <div className="rounded-md bg-bg p-2.5">
              <p className="mb-2 text-xs text-ink-2">
                Sei sicuro? Potrai chiedere la riattivazione in un secondo momento.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={busy}
                  className="rounded-md bg-orange px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  Conferma disattivazione
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeactivate(false)}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-[#F5C2C2] px-4 py-2 text-xs font-semibold text-red-600"
            >
              Richiedi cancellazione account
            </button>
          ) : (
            <div className="rounded-md bg-bg p-2.5">
              <p className="mb-2 text-xs text-ink-2">
                Questa azione avvia la cancellazione definitiva dei tuoi dati (diritto
                all&apos;oblio). Non è reversibile una volta completata.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRequestDeletion}
                  disabled={busy}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  Conferma richiesta
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
