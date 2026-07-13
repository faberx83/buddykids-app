"use client";

// REBRAND TRAMA Sprint 2 — schermata "Login · intro animata" (Dev Handoff,
// sezione 5a / 9): sequenza d'ingresso 5 fili che si intrecciano (asset
// trama-logo-mark.png) -> wordmark -> tagline -> CTA "Accedi"/"Crea un
// account" in fade-up sequenziale (delay 1.5s / 1.9s / 2.3s-2.4s, timing da
// sez. 9 del Dev Handoff). "Riprodotta una sola volta per sessione" (vedi
// LoginForm.tsx, che monta questo componente SOLO al primo paint della
// sessione, non ad ogni cambio di modalità).
//
// Le due CTA sono scorciatoie: un tap avanza subito al form reale (stesso
// componente <LoginForm>, non duplicato qui). Se l'utente non tocca nulla,
// la schermata avanza comunque da sola dopo AUTO_ADVANCE_MS — l'intro non è
// mai un vicolo cieco, né per un utente reale né per l'automazione Playwright
// (tests/fixtures/roles.ts#loginAs compila il form subito dopo aver navigato
// su /auth/login: l'attesa automatica di Playwright su getByLabel/getByRole
// copre comodamente questi ~4s).
const AUTO_ADVANCE_MS = 4200;

import { useEffect } from "react";

export default function TramaLoginIntro({
  onSelect,
}: {
  onSelect: (mode: "login" | "signup") => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onSelect("login"), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-trama-page px-8 py-10 sm:min-h-0 sm:flex-1">
      <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="trama-mark-in h-[104px] w-auto" />

      <img
        src="/brand/trama-wordmark.png"
        alt="TRAMA"
        className="trama-fade-up h-8 w-auto"
        style={{ animationDelay: "1.5s" }}
      />

      <p className="trama-fade-up mb-2 text-[13px] text-ink-2" style={{ animationDelay: "1.9s" }}>
        Organizing childhood. Together.
      </p>

      <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={() => onSelect("login")}
          className="trama-fade-up w-full rounded-full bg-trama-violet py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ animationDelay: "2.3s" }}
        >
          Accedi
        </button>
        <button
          type="button"
          onClick={() => onSelect("signup")}
          className="trama-fade-up w-full rounded-full border-[1.5px] border-[#E8EBF0] py-3.5 text-sm font-bold text-ink transition-colors hover:bg-bg"
          style={{ animationDelay: "2.4s" }}
        >
          Crea un account
        </button>
      </div>
    </div>
  );
}
