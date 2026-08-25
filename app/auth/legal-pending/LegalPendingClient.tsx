"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryPendingTermsAcceptanceAction } from "@/app/actions/legal";

// TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
// 25/08/2026 sera). Pagina di destinazione fail-closed: qui arriva SOLO un
// utente per cui LEGAL_TERMS_GATE risolve true (mai un utente reale oggi,
// gate globale OFF) E per cui non esiste ancora un'acceptance persistita
// per i Termini correnti — vedi app/auth/callback/route.ts. L'account
// esiste già in auth.users, ma il prodotto resta fail-closed finché
// l'acceptance non è scritta: nessun accesso silenzioso a "/".
export default function LegalPendingClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    const result = await retryPendingTermsAcceptanceAction();
    setLoading(false);
    if (result.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setError(
      result.error === "Nessun documento pubblicato per questo tipo"
        ? "Nessuna versione dei Termini è ancora pubblicata: riprova più tardi o contatta l'assistenza."
        : "Non è stato possibile registrare l'accettazione dei Termini. Riprova."
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-8 py-10 text-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-xl font-bold text-ink">Registrazione da completare</h1>
        <p className="mb-6 text-sm text-ink-2">
          Il tuo account è stato creato, ma non siamo riusciti a registrare l&apos;accettazione dei
          Termini di Servizio. Per motivi di sicurezza non puoi ancora accedere all&apos;app —
          riprova qui sotto.
        </p>

        {error && <p className="mb-4 text-xs font-medium text-orange">{error}</p>}

        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="w-full rounded-lg bg-trama-violet py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Attendere…" : "Riprova"}
        </button>
      </div>
    </div>
  );
}
