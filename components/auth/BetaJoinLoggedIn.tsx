"use client";

// TRAMA — LINK BETA PIÙ SICURO (20/11/2026). Mostrato da /auth/login?beta=…
// quando chi apre il link ha GIÀ un account ed è collegato: invece del modulo
// di registrazione, lo si aggiunge alla beta e lo si manda nell'app.

import { useEffect, useState } from "react";
import Link from "next/link";
import { joinBetaWithCodeAction } from "@/app/actions/beta-join";
import { betaJoinMessage, type BetaJoinOutcome } from "@/lib/beta-cohorts/code";

export default function BetaJoinLoggedIn({ code }: { code: string }) {
  const [outcome, setOutcome] = useState<BetaJoinOutcome | null>(null);

  useEffect(() => {
    let alive = true;
    joinBetaWithCodeAction(code)
      .then((r) => alive && setOutcome(r.outcome))
      .catch(() => alive && setOutcome("error"));
    return () => {
      alive = false;
    };
  }, [code]);

  const msg = outcome ? betaJoinMessage(outcome) : null;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-trama-page px-6" data-testid="beta-join-logged-in">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="mx-auto h-12 w-auto" />
        <h1 className="font-poppins text-[24px] font-semibold leading-tight text-trama-navy" role="status">
          {msg ? msg.title : "Un attimo…"}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">{msg ? msg.text : "Stiamo collegando il tuo account alla beta."}</p>
        {outcome && (
          <Link
            href="/nextgen"
            className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-trama-primary text-[16px] font-semibold text-white"
          >
            Apri TRAMA
          </Link>
        )}
      </div>
    </main>
  );
}
