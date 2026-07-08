"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Barra di caricamento in alto (stile "nprogress"): parte al mount — quindi
// anche per un refresh completo della pagina, non solo per la navigazione
// interna — e si ripete a ogni cambio di pathname. Serve come conferma
// visiva che la pagina si è davvero aggiornata, senza spostare l'utente da
// dove si trova (a differenza di un redirect forzato alla home).
//
// Il componente interno viene "keyato" sul pathname: così React lo rimonta
// da zero a ogni cambio pagina, e lo stato riparte naturalmente da
// "growing" senza dover richiamare setState dentro l'effetto solo per
// resettarlo (evita il pattern sconsigliato di setState sincrono in un
// effetto — qui l'effetto chiama setState solo dentro i timeout, in modo
// asincrono, che è l'uso corretto).
export default function PageLoadIndicator({ color }: { color: string }) {
  const pathname = usePathname();
  return <Bar key={pathname} color={color} />;
}

function Bar({ color }: { color: string }) {
  const [phase, setPhase] = useState<"growing" | "finishing" | "hidden">("growing");

  useEffect(() => {
    const toFinish = setTimeout(() => setPhase("finishing"), 300);
    const toHidden = setTimeout(() => setPhase("hidden"), 600);
    return () => {
      clearTimeout(toFinish);
      clearTimeout(toHidden);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-[60] h-[3px]"
      style={{
        width: phase === "growing" ? "75%" : "100%",
        background: color,
        opacity: phase === "finishing" ? 0 : 1,
        transition:
          phase === "growing"
            ? "width 320ms ease-out"
            : "width 200ms ease-out, opacity 250ms ease-out 150ms",
      }}
    />
  );
}
