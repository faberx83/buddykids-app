"use client";

// TRAMA — PROTEZIONE DEL CONTENITORE DELL'APP (21/10/2026).
// .app-shell ha altezza fissa e overflow nascosto: scorre solo l'area
// interna. Un "scrollIntoView" o il fuoco su un campo possono però far
// scorrere il contenitore stesso (overflow: hidden scorre lo stesso via
// script): l'app resta spostata in su con il bianco sotto la barra
// (segnalato da Fabrizio il 21/10 dopo aver aggiunto un impegno). Qui lo
// riportiamo sempre a zero. Non disegna niente.

import { useEffect } from "react";

export default function ShellScrollGuard() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;
    const reset = () => {
      if (shell.scrollTop !== 0) shell.scrollTop = 0;
      if (shell.scrollLeft !== 0) shell.scrollLeft = 0;
    };
    reset();
    shell.addEventListener("scroll", reset, { passive: true });
    return () => shell.removeEventListener("scroll", reset);
  }, []);
  return null;
}
