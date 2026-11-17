"use client";

// TRAMA — "USALA COME UN'APP" NELLA PAGINA DI BENVENUTO (17/11/2026).
// Fabrizio: "nella home page di benvenuto dovremmo aggiungere qualcosa che
// indichi come scaricare l'app PWA da android e iphone? o visto che c'è il
// pop-up è superfluo?" → "ok procedi".
// Perché non basta il pop-up (components/InstallPrompt.tsx): compare solo
// dentro l'app e dopo la prima azione utile; e su iPhone le notifiche (il
// buongiorno, i promemoria) arrivano solo se TRAMA è sulla schermata Home.
// Una riga sotto i pulsanti; tocca → foglietto con due schede (iPhone,
// Android), quella del telefono in uso già aperta. Aperta dall'icona
// (display-mode standalone) la riga non compare. Nessun dato salvato.

import { useEffect, useState } from "react";

type Platform = "ios" | "android";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent;
  // iPadOS si presenta come Mac: lo riconosciamo dal touch.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "android";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const STEPS: Record<Platform, { title: string; steps: React.ReactNode[]; note: string }> = {
  ios: {
    title: "Su iPhone",
    steps: [
      <>Apri tramapp.it con <b>Safari</b>.</>,
      <>
        Tocca <i className="ti ti-share-2" aria-hidden="true" /> <b>Condividi</b> (in basso).
      </>,
      <>
        Scegli <b>&quot;Aggiungi alla schermata Home&quot;</b>, poi <b>Aggiungi</b>.
      </>,
    ],
    note: "Su iPhone serve anche per ricevere le notifiche, come il buongiorno con la giornata dei figli.",
  },
  android: {
    title: "Su Android",
    steps: [
      <>Apri tramapp.it con <b>Chrome</b>.</>,
      <>
        Tocca <i className="ti ti-dots-vertical" aria-hidden="true" /> <b>menu</b> (in alto a destra).
      </>,
      <>
        Scegli <b>&quot;Installa app&quot;</b> o <b>&quot;Aggiungi a schermata Home&quot;</b>.
      </>,
    ],
    note: "Se compare il riquadro \"Aggiungi TRAMA alla schermata Home\", basta toccare Aggiungi.",
  },
};

export default function InstallAppHint() {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Platform>("android");

  useEffect(() => {
    setHidden(isStandalone());
    setTab(detectPlatform());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;
  const s = STEPS[tab];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] items-center gap-2 self-start text-[15px] font-semibold text-trama-accent-ink"
        data-testid="install-app-hint"
      >
        <i className="ti ti-device-mobile text-[20px]" aria-hidden="true" />
        Usala come un&apos;app: aggiungila alla schermata Home
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="presentation">
          <button type="button" aria-label="Chiudi" onClick={() => setOpen(false)} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-h"
            className="relative mx-auto flex w-full max-w-[480px] flex-col gap-4 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4 shadow-[0_-8px_30px_rgba(23,42,77,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="install-h" className="font-poppins text-[20px] font-semibold text-trama-navy">
                  TRAMA come un&apos;app
                </h2>
                <p className="text-[14px] leading-snug text-ink-2">Un&apos;icona sul telefono: la apri con un tocco, senza cercarla nel browser. Non serve nessuno store.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-trama-navy"
              >
                <i className="ti ti-x text-[18px]" aria-hidden="true" />
              </button>
            </div>

            <div role="tablist" aria-label="Telefono" className="grid grid-cols-2 gap-1 rounded-[12px] bg-[#F1F0EC] p-1">
              {(["ios", "android"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={tab === p}
                  onClick={() => setTab(p)}
                  className={`min-h-[40px] rounded-[9px] text-[14px] font-semibold ${
                    tab === p ? "bg-white text-trama-navy shadow-[0_1px_2px_rgba(23,42,77,0.12)]" : "text-ink-2"
                  }`}
                >
                  {p === "ios" ? "iPhone" : "Android"}
                </button>
              ))}
            </div>

            <ol className="flex flex-col gap-3" aria-label={s.title}>
              {s.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-trama-primary font-poppins text-[14px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-[15.5px] leading-snug text-ink">{step}</span>
                </li>
              ))}
            </ol>

            <p className="rounded-[14px] bg-trama-accent-soft px-3.5 py-3 text-[13.5px] leading-snug text-trama-accent-ink">{s.note}</p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[48px] rounded-[12px] bg-trama-primary text-[15px] font-semibold text-white active:bg-trama-primary-press"
            >
              Ho capito
            </button>
          </section>
        </div>
      )}
    </>
  );
}
