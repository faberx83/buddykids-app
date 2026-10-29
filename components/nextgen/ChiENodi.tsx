"use client";

// TRAMA — NODI THREAD, "CHI È NODI" (29/10/2026). Richiesta di Fabrizio:
// "potremmo anche aggiungere in qualche sezione 'chi è Nodi' con un minimo di
// spiega?". Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// Riquadro nella pagina "Cos'è TRAMA" (raggiunta dal Profilo), con la stessa
// forma del riquadro "Come funziona" che c'è già. Solo con NODI_ENABLED:
// senza il flag la pagina resta com'era. Testo adulto e breve, senza "io":
// Nodi non parla, è il segno di TRAMA che compare nei momenti giusti.
// Stato "welcome" (presentazione): l'"idle" del pacchetto ha un'ombra grigia
// alla base, il difetto segnalato da Fabrizio il 29/10.

import Nodi, { useNodiEnabled } from "@/components/nextgen/Nodi";
import { CHI_E_NODI_COPY, NODI_SIZE } from "@/lib/nextgen/nodi";

export default function ChiENodi() {
  const enabled = useNodiEnabled();
  if (!enabled) return null;
  return (
    <section
      aria-labelledby="nodi-h"
      className="flex flex-col gap-3 rounded-2xl border border-trama-line bg-white p-[18px]"
      data-testid="chi-e-nodi"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id="nodi-h" className="font-poppins text-[17px] font-semibold text-ink">
            {CHI_E_NODI_COPY.title}
          </h2>
          <p className="text-[13.5px] leading-snug text-ink-2">{CHI_E_NODI_COPY.intro}</p>
        </div>
        <Nodi state="welcome" size={NODI_SIZE.about} />
      </div>
      <p className="text-[13.5px] leading-snug text-ink-2">{CHI_E_NODI_COPY.when}</p>
      <p className="text-[13.5px] leading-snug text-ink-2">{CHI_E_NODI_COPY.what}</p>
    </section>
  );
}
