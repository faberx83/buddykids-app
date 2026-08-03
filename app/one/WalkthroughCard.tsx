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

  // TRAMA ONE Build Sprint 6 (hardening walkthrough, task #418) — hardening
  // di accessibilità e microcopy, nessun cambio di comportamento/logica:
  // - role="region" + aria-label sul contenitore: un lettore di schermo
  //   annuncia questo blocco come un'unità distinta dal resto della pagina,
  //   non solo testo sciolto.
  // - aria-live="polite" sul blocco che cambia (step corrente o messaggio di
  //   completamento): senza questo, uno screen reader non annuncia MAI il
  //   cambio di step dopo "Continua"/"Salta" — l'utente dovrebbe accorgersene
  //   da solo navigando di nuovo il DOM, un problema di accessibilità reale,
  //   non solo teorico (WCAG 4.1.3, "Status Messages").
  // - aria-describedby sui pulsanti, puntato al titolo dello step corrente:
  //   il testo visibile ("Inizia"/"Continua"/"Salta per ora") da solo non
  //   dice A QUALE step si riferisce se letto fuori contesto (es. rotore
  //   VoiceOver per elenco pulsanti della pagina) — deliberatamente
  //   aria-describedby e non aria-label, per non alterare il nome
  //   accessibile dei pulsanti (i test Playwright esistenti li individuano
  //   per nome esatto "Inizia"/"Continua").
  // - "Passo X di Y" oltre al contatore già esistente: il contatore
  //   "2/3" in alto è corretto ma isolato dal contenuto dello step, un
  //   utente che naviga per intestazioni/landmark non lo vede insieme al
  //   titolo dello step corrente.
  // - Microcopy: "Salta per ora" (invece di "Salta", per chiarire che non è
  //   definitivo) e "Ricomincia il percorso" (invece di "Rilancia percorso",
  //   linguaggio meno gergale).
  const stepPosition = currentIndex >= 0 ? currentIndex + 1 : steps.length;
  const doneCount = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;

  return (
    <div
      role="region"
      aria-label={progress.title}
      aria-busy={busy}
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
        <span style={{ fontSize: 12, color: "#8A93A3" }} aria-label={`${doneCount} di ${steps.length} step completati`}>
          {doneCount}/{steps.length}
        </span>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {!allDone && current && (
          <div>
            <div style={{ fontSize: 12, color: "#8A93A3", marginBottom: 2 }}>
              Passo {stepPosition} di {steps.length}
            </div>
            {/* id referenziato da aria-describedby sui pulsanti sotto: dà
                contesto ("a quale step si riferisce questo pulsante") senza
                toccare l'ACCESSIBLE NAME dei pulsanti, che resta il solo
                testo visibile ("Inizia"/"Continua") — i test Playwright
                esistenti (tests/one/walkthrough-partner.spec.ts, TC-N414/
                N415) usano getByRole("button", { name: "Inizia" | "Continua" })
                e si romperebbero se il nome accessibile includesse anche il
                titolo dello step (un aria-label, se presente, SOSTITUISCE
                il nome accessibile calcolato dal contenuto testuale, non lo
                estende). */}
            <div id="walkthrough-current-step-title" style={{ fontWeight: 600, fontSize: 14 }}>
              {current.title}
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 10px" }}>{current.description}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {current.status === "not_started" ? (
                <button
                  onClick={handleStart}
                  disabled={busy}
                  aria-describedby="walkthrough-current-step-title"
                  style={primaryBtn}
                >
                  Inizia
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  aria-describedby="walkthrough-current-step-title"
                  style={primaryBtn}
                >
                  Continua
                </button>
              )}
              <button
                onClick={handleSkip}
                disabled={busy}
                aria-describedby="walkthrough-current-step-title"
                style={secondaryBtn}
              >
                Salta per ora
              </button>
            </div>
          </div>
        )}

        {allDone && (
          <div>
            <p style={{ fontSize: 13, color: "#555" }}>Hai completato questo percorso.</p>
            <button onClick={handleRestart} disabled={busy} style={secondaryBtn}>
              Ricomincia il percorso
            </button>
          </div>
        )}
      </div>
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
