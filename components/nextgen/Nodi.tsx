"use client";

// TRAMA — NODI THREAD (28/10/2026). Richiesta di Fabrizio: "Apri
// CLAUDE_START_HERE.txt e segui le istruzioni senza ridisegnare né
// reinterpretare gli asset". Adattamento di web/Nodi.tsx del pacchetto
// TRAMA_NODI_THREAD_FINAL v1.0 (ADAPT): stesso <img> che referenzia gli SVG
// in /public/assets/nodi, più il flag NODI_ENABLED letto una volta dal layout
// NEXTGEN (NodiProvider). Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// - Flag spento (o fuori dal provider): <Nodi> non disegna niente e
//   useNodiEnabled() è false, così ogni punto dell'app resta com'era.
// - Decorativo per default (alt vuoto, aria-hidden): il testo accanto dice
//   già tutto.
// - Un solo Nodi principale per schermata: mentre un avviso con Nodi è in
//   basso, i Nodi marcati yieldToToast si nascondono.
// - Asset statici, nessuna animazione nella prima integrazione.
// - Ritocco 28/10 pomeriggio: Nodi è una presenza, non il protagonista. Si
//   inserisce negli elementi che esistono già, al posto di un'icona o accanto
//   a un testo, senza card nuove e senza cambiare spaziature (NODI_SIZE).

import { createContext, useContext, useMemo, useState } from "react";
import { nodiAsset, type NodiState } from "@/lib/nextgen/nodi";

interface NodiContextValue {
  enabled: boolean;
  toastActive: boolean;
  setToastActive: (on: boolean) => void;
}

const NodiContext = createContext<NodiContextValue>({ enabled: false, toastActive: false, setToastActive: () => {} });

export function NodiProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [toastActive, setToastActive] = useState(false);
  const value = useMemo(() => ({ enabled, toastActive, setToastActive }), [enabled, toastActive]);
  return <NodiContext.Provider value={value}>{children}</NodiContext.Provider>;
}

/** true solo con NODI_ENABLED acceso per questo utente. */
export function useNodiEnabled(): boolean {
  return useContext(NodiContext).enabled;
}

/** Per l'avviso in basso: segnala che sullo schermo c'è un Nodi di passaggio. */
export function useNodiToastSignal(): (on: boolean) => void {
  return useContext(NodiContext).setToastActive;
}

export default function Nodi({
  state = "idle",
  size = 48,
  navy = false,
  className = "",
  decorative = true,
  yieldToToast = false,
  fallback = null,
}: {
  state?: NodiState;
  /** Lato in px: sotto 32 diventa il micro, sopra 88 torna a 88, sotto 16 niente. Misure dell'app in NODI_SIZE. */
  size?: number;
  /** Fondo #172A4D: usa la variante -navy.svg (mai filtri CSS). */
  navy?: boolean;
  className?: string;
  decorative?: boolean;
  /** Si nasconde mentre è visibile un avviso con Nodi (regola: un Nodi per schermata). */
  yieldToToast?: boolean;
  /** Cosa mostrare quando Nodi non c'è (flag spento o si fa da parte): di solito l'icona che sostituisce. */
  fallback?: React.ReactNode;
}) {
  const { enabled, toastActive } = useContext(NodiContext);
  if (!enabled) return <>{fallback}</>;
  if (yieldToToast && toastActive) return <>{fallback}</>;
  const asset = nodiAsset(state, size, navy);
  if (!asset) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG statico del pacchetto, nessuna ottimizzazione da fare
    <img
      src={asset.src}
      width={asset.size}
      height={asset.size}
      className={`block flex-shrink-0 object-contain ${className}`}
      style={{ width: asset.size, height: asset.size }}
      alt={decorative ? "" : `Nodi: ${state}`}
      aria-hidden={decorative ? true : undefined}
      data-nodi={asset.micro ? "micro" : state}
      draggable={false}
    />
  );
}
