"use client";

// TRAMA — TRASLOCO SU tramapp.it (16/10/2026). Pagina d'arrivo sul NUOVO
// indirizzo: legge il passaggio di sessione dal frammento (#...), lo toglie
// subito dalla barra degli indirizzi e lo passa alla server action che apre
// la sessione. Poi porta alla pagina dove l'utente stava andando. Se qualcosa
// non va (link scaduto, già usato, manomesso) → pagina di accesso normale.

import { useEffect, useRef } from "react";
import PhoneShell from "@/components/PhoneShell";
import TramaSpinner from "@/components/TramaSpinner";
import { completeDomainMoveAction } from "@/app/actions/domain-move";

export default function TraslocoPage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname);
    completeDomainMoveAction(hash)
      .then((res) => {
        const dest = res.ok ? res.next : `/auth/login?next=${encodeURIComponent(res.next)}`;
        window.location.replace(dest);
      })
      .catch(() => window.location.replace("/auth/login"));
  }, []);

  return (
    <PhoneShell>
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-trama-page px-8 py-10 text-center sm:min-h-0 sm:flex-1"
        data-testid="trasloco"
      >
        <div className="mb-5">
          <TramaSpinner size={200} label="Ti stiamo portando su tramapp.it" />
        </div>
        <h1 className="mb-1 font-poppins text-[20px] font-semibold text-ink">TRAMA ha un nuovo indirizzo</h1>
        <p className="text-[15px] text-ink-2">tramapp.it — un attimo, ti portiamo dentro…</p>
      </div>
    </PhoneShell>
  );
}
