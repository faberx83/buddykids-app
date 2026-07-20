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

  async function handleStart() {
    if (!current) return;
    setBusy(true);
    setStepStatus(current.key, "in_progress");
    await startWalkthroughStepAction(progress.tutorialKey, current.key);
    setBusy(false);
  }

  async function handleComplete() {
    if (!current) return;
    setBusy(true);
    setStepStatus(current.key, "completed");
    await completeWalkthroughStepAction(progress.tutorialKey, current.key);
    nextStepAfter(current.key);
    setBusy(false);
  }

  async function handleSkip() {
    if (!current) return;
    setBusy(true);
    setStepStatus(current.key, "skipped");
    await skipWalkthroughStepAction(progress.tutorialKey, current.key);
    nextStepAfter(current.key);
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
