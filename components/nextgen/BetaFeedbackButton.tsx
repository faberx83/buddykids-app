"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { areaLabelFromPath } from "@/lib/nextgen/beta-feedback-areas";
import { submitBetaFeedbackAction } from "@/app/actions/beta-feedback";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

// SPRINT 5 (NEXTGEN) — "Segnala un problema" (feedback Fabrizio: floating CTA
// draggabile presente su ogni pagina dell'app genitori durante la BETA, per
// raccogliere bug/suggerimenti). Montata UNA sola volta in
// app/nextgen/layout.tsx, cosi copre ogni pagina genitore senza doverla
// aggiungere pagina per pagina — stesso principio di NextgenToastProvider.
//
// Esclusa esplicitamente da /nextgen/admin e /nextgen/center: quelle rotte
// sono ancora placeholder Sprint 0 (gestore/admin condividono per ora questo
// stesso layout genitore, vedi app/nextgen/layout.tsx), e Fabrizio ha
// chiesto esplicitamente che il meccanismo per l'app gestori sia una fase
// SUCCESSIVA e separata ("su cui poi implementeremo stesso meccanismo") —
// non va quindi mostrata lì già ora, per non anticipare quella fase con una
// UI mezza pronta.
//
// BUGFIX (Fabrizio: "la CTA la vedo su mobile PWA Android, non compare da
// web") — prima era `position: fixed` con i bound calcolati su
// window.innerWidth/innerHeight (il vero viewport del browser). Su mobile
// il viewport coincide con la cornice "telefono" (.app-shell, vedi
// PhoneShell.tsx) quindi sembrava funzionare; su desktop web .app-shell è
// una card centrata larga al massimo 480px dentro a un browser molto più
// largo, quindi il pulsante finiva ancorato all'angolo della FINESTRA
// (lontano dalla card, fuori dall'area visibile dell'app). Ora è
// `position: absolute`: essendo .app-shell il primo antenato posizionato
// (position: relative), diventa il suo offsetParent, e i bound per
// trascinamento/posizione di default sono presi da lì invece che dalla
// finestra — resta sempre dentro la cornice, sia su telefono reale che
// nell'anteprima desktop.
//
// Posizione trascinabile persistita in localStorage (solo lato client,
// nessun impatto su SSR): la stessa posizione resta tra una pagina e
// l'altra e tra sessioni, cosi l'utente la sposta una volta sola dove non
// gli dà fastidio.
const STORAGE_KEY = "trama-beta-feedback-pos";
const BUTTON_SIZE = 52;
const DRAG_THRESHOLD_PX = 6;

interface Pos {
  x: number;
  y: number;
}

function clamp(pos: Pos, width: number, height: number): Pos {
  const maxX = width - BUTTON_SIZE - 8;
  const maxY = height - BUTTON_SIZE - 8;
  return { x: Math.min(Math.max(pos.x, 8), Math.max(8, maxX)), y: Math.min(Math.max(pos.y, 8), Math.max(8, maxY)) };
}

// Dimensioni del contenitore posizionato più vicino (.app-shell in pratica):
// se non ancora disponibile (SSR o primo istante prima del mount) ricade sul
// viewport reale, solo come stima temporanea finché il ref non è attaccato.
function containerBounds(el: HTMLElement | null): { width: number; height: number } {
  const parent = el?.offsetParent as HTMLElement | null;
  if (parent) return { width: parent.clientWidth, height: parent.clientHeight };
  if (typeof window !== "undefined") return { width: window.innerWidth, height: window.innerHeight };
  return { width: 375, height: 667 };
}

export default function BetaFeedbackButton() {
  const pathname = usePathname();
  const showToast = useNextgenToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // null = nessuna posizione personalizzata ancora nota: il pulsante resta
  // nell'angolo di default via classi CSS (bottom-24 right-4), niente da
  // calcolare lato client — renderizzabile identico da SSR, senza flash.
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number; dragged: boolean } | null>(null);

  useEffect(() => {
    // La posizione salvata esiste solo nel browser — va per forza letta in
    // questo effetto "one-shot" al mount, stesso pattern già usato in
    // InstallPrompt.tsx per lo stesso motivo (user agent non derivabile a
    // runtime server).
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { width, height } = containerBounds(buttonRef.current);
        setPos(clamp(JSON.parse(raw), width, height));
      }
    } catch {
      // localStorage non disponibile (es. modalità privata) — resta la posizione di default (CSS).
    }
  }, []);

  // Sprint 0: gestore/admin condividono ancora questo layout (vedi commento
  // sopra) — la CTA non deve comparire lì, solo nelle pagine genitore vere.
  if (pathname?.startsWith("/nextgen/admin") || pathname?.startsWith("/nextgen/center")) return null;

  function persist(next: Pos) {
    setPos(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort, nessun blocco se localStorage non è scrivibile.
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = buttonRef.current?.getBoundingClientRect();
    const parent = buttonRef.current?.offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
    const originX = pos?.x ?? (rect && parentRect ? rect.left - parentRect.left : 0);
    const originY = pos?.y ?? (rect && parentRect ? rect.top - parentRect.top : 0);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX, originY, dragged: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      dragState.current.dragged = true;
    }
    if (dragState.current.dragged) {
      const { width, height } = containerBounds(buttonRef.current);
      persist(clamp({ x: dragState.current.originX + dx, y: dragState.current.originY + dy }, width, height));
    }
  }

  function handlePointerUp() {
    const wasDragged = dragState.current?.dragged ?? false;
    dragState.current = null;
    if (!wasDragged) setOpen(true);
  }

  async function handleSubmit() {
    if (!message.trim()) {
      setError("Scrivi qualcosa prima di inviare");
      return;
    }
    setSubmitting(true);
    setError(null);
    const area = areaLabelFromPath(pathname ?? "");
    const result = await submitBetaFeedbackAction(area, pathname ?? "", message);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("");
    setOpen(false);
    showToast("Segnalazione inviata, grazie!");
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="Segnala un problema"
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, touchAction: "none", ...(pos ? { left: pos.x, top: pos.y } : {}) }}
        className={`absolute z-[70] flex items-center justify-center rounded-full bg-trama-violet text-white shadow-lg active:scale-95 ${
          pos ? "" : "bottom-24 right-4"
        }`}
      >
        <i className="ti ti-message-report text-[22px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[15px] font-bold text-ink">Segnala un problema</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi" className="text-ink-3 active:scale-95">
                <i className="ti ti-x text-[18px]" />
              </button>
            </div>
            <p className="mb-3 text-[11.5px] text-ink-2">
              Fase BETA — descrivi un bug o un suggerimento. Sappiamo già da quale pagina scrivi (
              {areaLabelFromPath(pathname ?? "")}).
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cosa non funziona o cosa miglioreresti?"
              rows={4}
              className="w-full resize-none rounded-xl border border-[#E8EBF0] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-trama-violet"
            />
            {error && <p className="mt-2 text-[12px] font-medium text-orange">{error}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="mt-3 w-full rounded-full bg-trama-violet py-2.5 text-[13.5px] font-bold text-white active:scale-[0.97] disabled:opacity-50"
            >
              {submitting ? "Invio…" : "Invia segnalazione"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
