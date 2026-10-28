"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
// NODI THREAD (28/10/2026): avviso "ricco" con Nodi per le connessioni e i
// successi che contano (mai a ogni salvataggio). Senza `nodi` l'avviso è
// identico a prima.
import Nodi, { useNodiEnabled, useNodiToastSignal } from "@/components/nextgen/Nodi";
import type { NodiState } from "@/lib/nextgen/nodi";

// SPRINT CORRETTIVO (NEXTGEN) — "Aumentare il numero di micro-feedback
// positivi... piccoli messaggi rassicuranti, evitare popup invasivi"
// (richiesta di Fabrizio). Toast non modale, in fondo allo schermo, si
// chiude da solo: nessun blocco dell'interazione, nessun click per chiudere
// necessario. Montato UNA volta in app/nextgen/layout.tsx, così qualsiasi
// componente client sotto /nextgen può richiamare useNextgenToast() senza
// prop-drilling. Non tocca nulla di LEGACY (nessun sistema simile esisteva
// prima in tutto il progetto).
type ToastKind = "success" | "info";
interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
  nodi: NodiState | null;
}

type PushToast = (text: string, kind?: ToastKind, options?: { nodi?: NodiState }) => void;

const NextgenToastContext = createContext<PushToast>(() => {});

export function NextgenToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const nodiEnabled = useNodiEnabled();
  const signalNodi = useNodiToastSignal();

  const push = useCallback<PushToast>(
    (text, kind = "success", options) => {
      const id = Date.now() + Math.random();
      const nodi = nodiEnabled ? (options?.nodi ?? null) : null;
      setToasts((prev) => [...prev, { id, text, kind, nodi }]);
      // Auto-dismiss: nessuna azione richiesta all'utente, coerente con "evitare
      // popup invasivi" — 2.6s è abbastanza per leggere un messaggio breve senza
      // restare in mezzo troppo a lungo (3.2s per l'avviso con Nodi, breve e non bloccante).
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, nodi ? 3200 : 2600);
    },
    [nodiEnabled]
  );

  // Un Nodi per schermata: mentre l'avviso con Nodi è visibile, gli altri si fanno da parte.
  const nodiShown = toasts.some((t) => t.nodi);
  useEffect(() => {
    signalNodi(nodiShown);
  }, [nodiShown, signalNodi]);

  return (
    <NextgenToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-5">
        {toasts.map((t) =>
          t.nodi ? (
            <div
              key={t.id}
              role="status"
              data-testid="nodi-toast"
              className="animate-toast-in pointer-events-none flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-trama-line bg-white py-2.5 pl-2.5 pr-4 shadow-[0_8px_24px_rgba(23,42,77,0.10)]"
            >
              <Nodi state={t.nodi} size={56} />
              <span className="font-poppins text-[14.5px] font-semibold leading-snug text-trama-navy">{t.text}</span>
            </div>
          ) : (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-none flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg"
          >
            <i className={`ti ${t.kind === "success" ? "ti-circle-check-filled text-green" : "ti-info-circle"} text-[14px]`} />
            {t.text}
          </div>
          )
        )}
      </div>
    </NextgenToastContext.Provider>
  );
}

export function useNextgenToast() {
  return useContext(NextgenToastContext);
}
