"use client";

// TRAMA — "INDIETRO" CHIUDE I FOGLI (15/10/2026, segnalazione Fabrizio: "il +
// centrale si chiude solo se clicco la x ma deve chiudersi anche con
// indietro"). Su Android il tasto/gesto Indietro, e sul web il pulsante del
// browser, prima uscivano dalla pagina lasciando il foglio aperto sotto.
//
// Come funziona: quando un foglio si apre si aggiunge una voce alla
// cronologia (stesso indirizzo, nessun ricaricamento); "Indietro" consuma
// quella voce e chiude il foglio. Se il foglio si chiude in altro modo (X,
// sfondo, Esc) la voce si toglie da sola con history.back(), così il
// successivo "Indietro" fa quello che ci si aspetta.
//
// Per un link dentro il foglio usare `closeThenNavigate(href)`: prima si
// toglie la voce del foglio, poi si naviga — la cronologia resta pulita.

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const KEY = "__tramaSheet";

// 20/10/2026 — BUG (Fabrizio: "se clicco da decidere torna indietro, assegna
// non fa nulla"): passando da un foglio all'altro (Chi fa cosa → Chi
// accompagna venerdì) il primo, chiudendosi, toglieva la sua voce con
// history.back() DOPO che il secondo aveva aggiunto la propria: il "back"
// arrivava al secondo foglio e lo chiudeva subito. Ora la chiusura è rinviata
// di un attimo: se nel frattempo si apre un altro foglio, questo riusa la voce
// del primo (stessa posizione in cronologia) invece di aggiungerne una nuova.
let pendingBack: { marker: number; timer: ReturnType<typeof setTimeout> } | null = null;

export function useCloseOnBack(active: boolean, onClose: () => void): { closeThenNavigate: (href: string) => void } {
  const router = useRouter();
  const onCloseRef = useRef(onClose);
  const markerRef = useRef<number | null>(null);
  const pendingHrefRef = useRef<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const marker = Date.now() + Math.random();
    markerRef.current = marker;
    try {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (pendingBack && state[KEY] === pendingBack.marker) {
        // Un foglio si è appena chiuso per far posto a questo: si riusa la sua voce.
        clearTimeout(pendingBack.timer);
        pendingBack = null;
        window.history.replaceState({ ...state, [KEY]: marker }, "");
      } else {
        window.history.pushState({ ...state, [KEY]: marker }, "");
      }
    } catch {
      return;
    }
    let poppedByBack = false;
    const onPop = () => {
      if (markerRef.current !== marker) return;
      poppedByBack = true;
      markerRef.current = null;
      const href = pendingHrefRef.current;
      pendingHrefRef.current = null;
      onCloseRef.current();
      if (href) router.push(href);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Chiuso con X / sfondo / Esc: si toglie la voce aggiunta, se è ancora quella corrente.
      if (!poppedByBack && markerRef.current === marker && (window.history.state as Record<string, unknown> | null)?.[KEY] === marker) {
        markerRef.current = null;
        const timer = setTimeout(() => {
          if (pendingBack?.marker !== marker) return;
          pendingBack = null;
          // Solo se si è ancora sulla voce del foglio (nel frattempo nessuna navigazione).
          if ((window.history.state as Record<string, unknown> | null)?.[KEY] === marker) window.history.back();
        }, 0);
        pendingBack = { marker, timer };
      }
    };
  }, [active, router]);

  const closeThenNavigate = useCallback(
    (href: string) => {
      if (markerRef.current !== null && (window.history.state as Record<string, unknown> | null)?.[KEY] === markerRef.current) {
        pendingHrefRef.current = href;
        window.history.back(); // onPop chiude il foglio e poi naviga
      } else {
        onCloseRef.current();
        router.push(href);
      }
    },
    [router]
  );

  return { closeThenNavigate };
}
