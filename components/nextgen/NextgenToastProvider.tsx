"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
// NODI THREAD (28/10/2026): nelle conferme che contano (mai a ogni
// salvataggio) un Nodi piccolo prende il posto della spunta, nello stesso
// avviso a pillola. Senza `nodi` l'avviso è identico a prima.
import Nodi, { useNodiEnabled, useNodiToastSignal } from "@/components/nextgen/Nodi";
import { NODI_SIZE, type NodiState } from "@/lib/nextgen/nodi";

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
      // restare in mezzo troppo a lungo.
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
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
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-none flex items-center gap-1.5 rounded-full text-[12.5px] font-semibold text-white shadow-lg ${
              t.nodi ? "bg-trama-navy py-1 pl-1.5 pr-4" : "bg-ink px-4 py-2.5"
            }`}
            data-testid={t.nodi ? "nodi-toast" : undefined}
          >
            {/* Con Nodi: fondo #172A4D e la sua variante navy, come chiede il pacchetto. */}
            {t.nodi ? (
              <Nodi state={t.nodi} size={NODI_SIZE.toast} navy />
            ) : (
              <i className={`ti ${t.kind === "success" ? "ti-circle-check-filled text-green" : "ti-info-circle"} text-[14px]`} />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </NextgenToastContext.Provider>
  );
}

export function useNextgenToast() {
  return useContext(NextgenToastContext);
}
