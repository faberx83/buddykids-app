"use client";

import { createContext, useCallback, useContext, useState } from "react";

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
}

const NextgenToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function NextgenToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const push = useCallback((text: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    // Auto-dismiss: nessuna azione richiesta all'utente, coerente con "evitare
    // popup invasivi" — 2.6s è abbastanza per leggere un messaggio breve senza
    // restare in mezzo troppo a lungo.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <NextgenToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-none flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg"
          >
            <i className={`ti ${t.kind === "success" ? "ti-circle-check-filled text-green" : "ti-info-circle"} text-[14px]`} />
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
