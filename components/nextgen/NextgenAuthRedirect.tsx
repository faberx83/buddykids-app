"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// FIX (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — segnalazione di
// Fabrizio, con screenshot: sessione scaduta dentro l'app NEXTGEN installata
// → si è ritrovato in una scheda browser invece che nell'app). Causa:
// app/nextgen/layout.tsx faceva redirect("/auth/login?next=/nextgen") lato
// SERVER (next/navigation#redirect) — per la richiesta che carica /nextgen
// (scope della PWA installata) la risposta HTTP era già un redirect verso
// /auth/login, FUORI da quello scope: esattamente la stessa classe di bug
// già vista e corretta per il deep link push (7e739ee), qui rientrante per
// la scadenza sessione.
//
// Questo componente sposta il redirect lato CLIENT: la pagina risponde
// prima con HTML valido sotto /nextgen (dentro scope), poi — a
// idratazione avvenuta — router.replace() fa una transizione SPA, mai una
// nuova navigazione top-level, quindi non rischia lo scope-escape (stesso
// principio già stabilito per Link/router.push in questo progetto).
export default function NextgenAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/login?next=/nextgen");
  }, [router]);

  return null;
}
