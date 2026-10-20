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
  // FINAL PRE-FREEZE WAVE (08/09/2026) — questo componente viene ora riusato
  // anche per i due carousel di benvenuto (parent_beta_onboarding,
  // partner_beta_onboarding) e per il tour guidato Parent
  // (discover_book_parent), non solo per il tour guidato Partner originale.
  // Il messaggio "riparte dal primo passo appena vai su 'Le tue attività'"
  // era hardcoded e specifico SOLO al primo step di activity_creation_
  // partner — sbagliato per qualunque altro percorso. Tre prop opzionali,
  // tutte con default che preservano ESATTAMENTE il comportamento/testo
  // originale per l'unico chiamante preesistente (nessuna regressione lì).
  sectionLabel = "Tour guidato",
  description,
  restartedMessage,
  actionLabel,
  v2 = false,
}: {
  /** 20/10/2026 — Impostazioni V2: riga dentro la card "Aiuto e guida"
   *  (stessi testi e stessa azione; altrove invariato). */
  v2?: boolean;
  tutorialKey: string;
  tutorialTitle: string;
  sectionLabel?: string;
  description?: string;
  restartedMessage?: string;
  actionLabel?: string;
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

  if (v2) {
    return (
      <div className="flex flex-col gap-1 px-4 py-3.5">
        <span className="text-[15px] font-semibold text-ink">{sectionLabel}</span>
        <p className="text-[13px] leading-snug text-ink-2">{description}</p>
        {done ? (
          <p role="status" className="mt-1 text-[13px] font-medium text-[#146B4F]">
            {restartedMessage}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleRestart}
            disabled={busy}
            className="flex min-h-[44px] items-center self-start text-[14px] font-semibold text-trama-accent-ink disabled:opacity-60"
          >
            <i className="ti ti-refresh mr-1.5" aria-hidden="true" />
            {busy ? "Riavvio…" : (actionLabel ?? "Riavvia il tour guidato")}
          </button>
        )}
        {error && <p className="text-[13px] font-medium text-[#B3261E]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <div className="mb-1 text-xs font-semibold text-ink-2">{sectionLabel}</div>
      <p className="mb-2.5 text-[13px] text-ink-2">
        {description ?? (
          <>
            &quot;{tutorialTitle}&quot; ti accompagna passo passo la prossima volta che navighi
            nell&apos;app — utile se vuoi rivederlo da capo o se lo hai saltato per errore.
          </>
        )}
      </p>
      {done ? (
        <p className="text-[13px] font-medium text-trama-violet">
          {restartedMessage ?? 'Percorso riavviato: riparte dal primo passo appena vai su "Le tue attività".'}
        </p>
      ) : (
        <button
          onClick={handleRestart}
          disabled={busy}
          className="rounded-md border border-[#E8EBF0] bg-transparent px-3.5 py-2 text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          {busy ? "Riavvio…" : (actionLabel ?? "Riavvia il tour guidato")}
        </button>
      )}
      {error && <p className="mt-2 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}
