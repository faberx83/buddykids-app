"use client";

// TRAMA ONE Build Sprint 1 — componente generico per il motore Walkthrough.
// Non specifico del percorso "welcome_parent": riceve tutorialKey/steps già
// risolti da lib/walkthrough/data.ts e chiama le Server Actions generiche di
// app/actions/walkthrough.ts — riusabile per qualunque altro tutorial_key
// futuro senza modifiche.

import { useState } from "react";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  startWalkthroughStepAction,
  completeWalkthroughStepAction,
  skipWalkthroughStepAction,
  restartWalkthroughAction,
} from "@/app/actions/walkthrough";

export default function WalkthroughCard({ progress }: { progress: WalkthroughProgressSummary }) {
  const [steps, setSteps] = useState(progress.steps);
  const [currentKey, setCurrentKey] = useState(progress.currentStepKey);
  const [busy, setBusy] = useState(false);

  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const allDone = !current;

  function setStepStatus(key: string, status: (typeof steps)[number]["status"]) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  }

  function nextStepAfter(key: string) {
    const idx = steps.findIndex((s) => s.key === key);
    const next = steps.slice(idx + 1).find((s) => s.status === "not_started" || s.status === "in_progress");
    setCurrentKey(next?.key ?? null);
  }

  // TRAMA ONE Build Sprint 6 (backlog vincolante P2, TC-N414/N415,
  // SPRINT_GOVERNANCE.md riga 152, DEC-50) — bug reale trovato con evidenza
  // diretta (lettura del codice, non ipotesi): i tre handler sotto
  // aggiornavano lo stato locale (setStepStatus/nextStepAfter) PRIMA di
  // attendere la Server Action corrispondente, un pattern "ottimistico"
  // diverso dalla convenzione già stabilita altrove nel repository (vedi
  // CenterLeadsAdminClient.tsx: "patcha lo stato locale SOLO dopo il
  // successo della action"). Click .click() di Playwright si risolve subito
  // dopo aver dispatchato l'evento, non attende che la Promise ritornata
  // dall'handler onClick sia risolta: il bottone passava a "Continua"
  // (localmente) ben prima che l'upsert su tutorial_progress arrivasse
  // davvero a Supabase. Se il test ricaricava la pagina (page.reload(),
  // fonte di verità = Server Component + DB) prima che l'upsert fosse
  // confermato, il passo tornava "not_started" — esattamente il fallimento
  // intermittente osservato per due run consecutive (Gate C, nona/decima
  // ondata) nonostante la serializzazione del file di test (che risolve solo
  // l'ordine TRA i due test, non la corsa DENTRO il singolo test). Bug reale
  // anche per un utente vero, non solo per il test: in caso di rete lenta o
  // errore, l'interfaccia mostrava un progresso mai davvero salvato.
  async function handleStart() {
    if (!current) return;
    setBusy(true);
    const result = await startWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setStepStatus(current.key, "in_progress");
    } else {
      console.error("[walkthrough] Impossibile avviare lo step:", result.error);
    }
    setBusy(false);
  }

  async function handleComplete() {
    if (!current) return;
    setBusy(true);
    const result = await completeWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setStepStatus(current.key, "completed");
      nextStepAfter(current.key);
    } else {
      console.error("[walkthrough] Impossibile completare lo step:", result.error);
    }
    setBusy(false);
  }

  async function handleSkip() {
    if (!current) return;
    setBusy(true);
    const result = await skipWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setStepStatus(current.key, "skipped");
      nextStepAfter(current.key);
    } else {
      console.error("[walkthrough] Impossibile saltare lo step:", result.error);
    }
    setBusy(false);
  }

  async function handleRestart() {
    setBusy(true);
    await restartWalkthroughAction(progress.tutorialKey);
    setSteps(progress.steps.map((s) => ({ ...s, status: "not_started" })));
    setCurrentKey(progress.steps[0]?.key ?? null);
    setBusy(false);
  }

  return (
    <div
      style={{
        marginTop: 16,
        maxWidth: 480,
        border: "1px solid #E8EBF0",
        borderRadius: 10,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>{progress.title}</strong>
        <span style={{ fontSize: 12, color: "#8A93A3" }}>
          {steps.filter((s) => s.status === "completed" || s.status === "skipped").length}/{steps.length}
        </span>
      </div>

      {!allDone && current && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{current.title}</div>
          <p style={{ fontSize: 13, color: "#555", margin: "4px 0 10px" }}>{current.description}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {current.status === "not_started" ? (
              <button onClick={handleStart} disabled={busy} style={primaryBtn}>
                Inizia
              </button>
            ) : (
              <button onClick={handleComplete} disabled={busy} style={primaryBtn}>
                Continua
              </button>
            )}
            <button onClick={handleSkip} disabled={busy} style={secondaryBtn}>
              Salta
            </button>
          </div>
        </div>
      )}

      {allDone && (
        <div>
          <p style={{ fontSize: 13, color: "#555" }}>Percorso completato.</p>
          <button onClick={handleRestart} disabled={busy} style={secondaryBtn}>
            Rilancia percorso
          </button>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "#2E86DE",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: "#333",
  border: "1px solid #E8EBF0",
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
