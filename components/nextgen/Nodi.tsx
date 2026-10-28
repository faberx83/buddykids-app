"use client";

// TRAMA — NODI THREAD (28/10/2026). Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// 28/10 sera: asset del pacchetto TRAMA_NODI_THREAD_REFERENCE_PACK_v2
// ("versione APPROVATA", PNG estratti dalla reference, invariati) al posto di
// quelli v1.0. Adattamento di web/NodiThread.tsx del pacchetto (ADAPT): stesso
// <img> sugli asset del manifest, più il flag NODI_ENABLED letto una volta
// dal layout NEXTGEN (NodiProvider).
//
// - Flag spento (o fuori dal provider): <Nodi> rende solo il ripiego
//   (`fallback`, di solito l'icona che sostituisce) e useNodiEnabled() è
//   false, così ogni punto dell'app resta com'era.
// - L'immagine sta dentro un quadrato di `size` px (object-fit: contain): non
//   si deforma e occupa lo stesso posto di prima.
// - Decorativo per default (alt vuoto, aria-hidden): il testo accanto dice
//   già tutto.
// - Nessuna animazione. Presenza, non protagonista: si inserisce negli
//   elementi che esistono già, senza card nuove e senza cambiare spaziature.

import { createContext, useContext } from "react";
import { nodiAsset, type NodiState } from "@/lib/nextgen/nodi";

const NodiContext = createContext<boolean>(false);

export function NodiProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <NodiContext.Provider value={enabled}>{children}</NodiContext.Provider>;
}

/** true solo con NODI_ENABLED acceso per questo utente. */
export function useNodiEnabled(): boolean {
  return useContext(NodiContext);
}

export default function Nodi({
  state = "idle",
  size = 48,
  navy = false,
  className = "",
  decorative = true,
  fallback = null,
}: {
  state?: NodiState;
  /** Lato massimo in px (NODI_SIZE): sotto 32 Nodi non compare, sopra 88 torna a 88. */
  size?: number;
  /** Fondo scuro: il pacchetto v2 non ha varianti navy, quindi Nodi non compare. */
  navy?: boolean;
  className?: string;
  decorative?: boolean;
  /** Cosa mostrare quando Nodi non c'è (flag spento o asset non adatto): di solito l'icona che sostituisce. */
  fallback?: React.ReactNode;
}) {
  const enabled = useContext(NodiContext);
  if (!enabled) return <>{fallback}</>;
  const asset = nodiAsset(state, size, navy);
  if (!asset) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG statico del pacchetto, nessuna ottimizzazione da fare
    <img
      src={asset.src}
      srcSet={`${asset.src} 1x, ${asset.src2x} 2x`}
      width={asset.size}
      height={asset.size}
      className={`pointer-events-none block flex-shrink-0 select-none object-contain ${className}`}
      style={{ width: asset.size, height: asset.size }}
      alt={decorative ? "" : `Nodi: ${state}`}
      aria-hidden={decorative ? true : undefined}
      data-nodi={state}
      draggable={false}
    />
  );
}
