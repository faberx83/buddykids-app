"use client";

// REBRAND TRAMA Sprint 2 (rivisto su richiesta di Fabrizio) — header animato
// di /auth/login: fili -> wordmark -> tagline (Dev Handoff sez. 5a/9). A
// differenza della prima versione, NON è più una schermata separata con CTA
// proprie: è l'intestazione permanente sopra il form reale (email/password),
// sempre sulla stessa pagina — "i campi di accesso devono apparire sotto il
// logo animato, non su una pagina successiva" (richiesta esplicita, con
// screenshot di riferimento). L'animazione va in scena solo se `animate` è
// true (prima visita della sessione, deciso da LoginForm.tsx tramite
// sessionStorage); altrimenti l'header compare già "a posto", senza delay.
export default function TramaLoginHeader({ animate }: { animate: boolean }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <img
        src="/brand/trama-logo-mark.png"
        alt=""
        aria-hidden="true"
        className={`h-[84px] w-auto ${animate ? "trama-mark-in" : ""}`}
      />
      <img
        src="/brand/trama-wordmark.png"
        alt="TRAMA"
        className={`h-7 w-auto ${animate ? "trama-fade-up" : ""}`}
        style={animate ? { animationDelay: "1.5s" } : undefined}
      />
      <p
        className={`text-[13px] text-ink-2 ${animate ? "trama-fade-up" : ""}`}
        style={animate ? { animationDelay: "1.9s" } : undefined}
      >
        Organizing childhood. Together.
      </p>
    </div>
  );
}
