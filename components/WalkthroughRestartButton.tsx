"use client";

// Visual Acceptance Gate (§15, DEC-70) — Fabrizio ha chiesto se il tour
// guidato si può riaccendere dalle impostazioni del profilo: prima d'ora
// `restartWalkthroughAction` (app/actions/walkthrough.ts) esisteva già ed è
// generica per costruzione (funziona per qualunque tutorial_key), ma non era
// raggiungibile da nessun bottone reale per il Partner — l'unico modo era
// uno script da terminale (node tests/cleanup-test-data.mjs, vedi
// TRAMA_ONE_VISUAL_ACCEPTANCE.md §4) o un "Ricomincia il percorso" mostrato
// SOLO a percorso già completato dentro WalkthroughCard.tsx (Parent, /one).
// Questo componente è un bottone standalone, riusabile da qualunque pagina
// impostazioni (Partner oggi, potenzialmente Parent/Admin in futuro senza
// modifiche): riavvia SEMPRE, indipendentemente da quanto il percorso è
// avanzato — a differenza del bottone dentro WalkthroughCard, visibile solo
// a percorso concluso.

import { useState } from "react";
import { restartWalkthroughAction } from "@/app/actions/walkthrough";

export default function WalkthroughRestartButton({
  tutorialKey,
  tutorialTitle,
}: {
  tutorialKey: string;
  tutorialTitle: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestart() {
    setBusy(true);
    setError(null);
    const result = await restartWalkthroughAction(tutorialKey);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <div className="mb-1 text-xs font-semibold text-ink-2">Tour guidato</div>
      <p className="mb-2.5 text-[13px] text-ink-2">
        &quot;{tutorialTitle}&quot; ti accompagna passo passo la prossima volta che navighi
        nell&apos;app — utile se vuoi rivederlo da capo o se lo hai saltato per errore.
      </p>
      {done ? (
        <p className="text-[13px] font-medium text-trama-violet">
          Percorso riavviato: riparte dal primo passo appena vai su &quot;Le tue attività&quot;.
        </p>
      ) : (
        <button
          onClick={handleRestart}
          disabled={busy}
          className="rounded-md border border-[#E8EBF0] bg-transparent px-3.5 py-2 text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          {busy ? "Riavvio…" : "Riavvia il tour guidato"}
        </button>
      )}
      {error && <p className="mt-2 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}
