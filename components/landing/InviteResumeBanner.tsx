"use client";

// TRAMA — RIPRENDI L'INVITO (20/11/2026). Fabrizio: "come è possibile che
// Greta sia finita lì se ha il mio link?". Se questo browser ha già aperto un
// link d'invito (codice ricordato da LoginForm), sulla pagina di benvenuto non
// si chiede un altro invito: si torna alla registrazione con il proprio.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BETA_CODE_STORAGE_KEY, normalizeBetaCode } from "@/lib/beta-cohorts/code";

export default function InviteResumeBanner() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    try {
      setCode(normalizeBetaCode(window.localStorage.getItem(BETA_CODE_STORAGE_KEY)));
    } catch {
      /* memoria non disponibile: niente riquadro */
    }
  }, []);
  if (!code) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-trama-line bg-white px-4 py-3.5" data-testid="invite-resume">
      <p className="text-[15px] font-semibold text-trama-navy">Hai già un invito a TRAMA</p>
      <p className="text-[14px] leading-snug text-ink-2">Non serve chiederne un altro: completa la registrazione da qui.</p>
      <Link
        href={`/auth/login?beta=${encodeURIComponent(code)}`}
        className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary text-[15px] font-semibold text-white"
      >
        Registrati con il tuo invito
      </Link>
    </div>
  );
}
