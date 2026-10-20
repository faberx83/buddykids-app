"use client";

// TRAMA — pagina di benvenuto, "Cosa fa TRAMA" a scorrimento automatico
// (20/10/2026, Fabrizio: "uno slider… e se le pagine le facessimo già
// automatiche tipo video?"). Come le storie: barrette in alto che si
// riempiono, ogni schermata resta 6 secondi e passa da sola alla successiva;
// sull'ultima si ferma con "Chiedi un invito" (pulsante "Riguarda").
// Testi e schermate demo sono quelli del carosello di primo ingresso
// (lib/nextgen/onboarding-slides.ts), riusati senza copiarli.
//
// Comandi: tocco sulle barrette o frecce per scegliere, scorrimento laterale
// col dito, pausa/riprendi (obbligatorio per contenuti che si muovono da
// soli, WCAG 2.2.2). Si ferma da solo quando la fascia non è sullo schermo e
// mentre il dito la tocca (col mouse no: la fascia occupa quasi tutto lo
// schermo e non partirebbe mai). Con "riduci movimento": niente avanzamento
// automatico né animazioni, solo i comandi.

import { useCallback, useEffect, useRef, useState } from "react";
import { ONBOARDING_SLIDES } from "@/lib/nextgen/onboarding-slides";
import LandingPhone from "@/components/landing/LandingPhone";

export const SLIDE_MS = 6000;
const TONES = ["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"];

export default function FeatureSlider() {
  const n = ONBOARDING_SLIDES.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  // 20/10/2026: come un video, si ferma sull'ultima schermata (con "Chiedi un
  // invito") invece di ricominciare da capo; "Riguarda" la fa ripartire.
  const [finished, setFinished] = useState(false);
  const [touching, setTouching] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = useCallback(
    (i: number) => {
      setFinished(false);
      setIndex(((i % n) + n) % n);
    },
    [n]
  );
  const isLast = index === n - 1;
  const playing = !userPaused && !finished && !touching && visible && !reduced;
  const slide = ONBOARDING_SLIDES[index];

  return (
    <section
      ref={rootRef}
      aria-roledescription="carosello"
      aria-label="Cosa puoi fare con TRAMA"
      className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-12 md:py-16"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
        setTouching(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        setTouching(false);
        if (start === null || end === null) return;
        if (end - start < -40) go(index + 1);
        else if (end - start > 40) go(index - 1);
      }}
    >
      {/* Barrette di avanzamento: una per schermata, toccabili */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" role="group" aria-label="Schermate">
          {ONBOARDING_SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1} di ${n}: ${s.eyebrow}`}
              aria-current={i === index ? "true" : undefined}
              className="flex min-h-[28px] flex-1 items-center"
            >
              <span className="relative block h-[4px] w-full overflow-hidden rounded-full bg-trama-line">
                <span
                  key={i === index ? `on-${index}` : `off-${i}`}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: TONES[i % TONES.length],
                    width: i < index || (i === index && (reduced || finished)) ? "100%" : i === index ? undefined : "0%",
                    animation: i === index && !reduced ? `trama-slider-fill ${SLIDE_MS}ms linear forwards` : undefined,
                    animationPlayState: playing ? "running" : "paused",
                  }}
                  onAnimationEnd={() => {
                    if (i !== index) return;
                    if (isLast) setFinished(true);
                    else go(index + 1);
                  }}
                />
              </span>
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => {
              if (finished) {
                setUserPaused(false);
                go(0);
                return;
              }
              setUserPaused((p) => !p);
            }}
            aria-label={finished ? "Riguarda da capo" : userPaused ? "Riprendi lo scorrimento" : "Metti in pausa lo scorrimento"}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-trama-line bg-white text-trama-navy"
          >
            <i className={`ti ${finished ? "ti-reload" : userPaused ? "ti-player-play" : "ti-player-pause"} text-[16px]`} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        key={slide.key}
        aria-live={playing ? "off" : "polite"}
        className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12 motion-safe:animate-[trama-onb-screen_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        <div className="order-2 flex min-h-[220px] flex-col gap-3 md:order-1">
          <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: TONES[index % TONES.length] }}>
            <span aria-hidden="true" className="h-[3px] w-6 rounded-full" style={{ background: TONES[index % TONES.length] }} />
            {slide.eyebrow}
          </span>
          <h3 className="text-balance font-poppins text-[clamp(26px,6.4vw,38px)] font-semibold leading-[1.1] text-trama-navy">
            {slide.titleBefore}
            <span className="text-trama-accent-ink">{slide.titleHighlight}</span>
            {slide.titleAfter}
          </h3>
          <p className="max-w-[44ch] text-[16px] leading-relaxed text-ink-2">{slide.body}</p>
          <p className="text-[14px] text-ink-2">{slide.note}</p>
          {isLast && (
            <a
              href="#invito"
              className="mt-2 flex min-h-[52px] items-center justify-center self-start rounded-[12px] bg-trama-primary px-6 text-[16px] font-semibold text-white active:bg-trama-primary-press"
              data-testid="slider-cta"
            >
              Chiedi un invito
            </a>
          )}
        </div>
        <div className="order-1 flex justify-center md:order-2">
          <LandingPhone visual={slide.visual} tilt={index % 2 === 0 ? -8 : 8} float={!reduced} />
        </div>
      </div>

      {/* Chi legge la pagina senza eseguirla (motori di ricerca, ChatGPT e
          simili) vede comunque tutte e quattro le schermate. */}
      <noscript>
        <ul>
          {ONBOARDING_SLIDES.map((s) => (
            <li key={s.key}>
              <h3>{`${s.eyebrow}: ${s.titleBefore}${s.titleHighlight}${s.titleAfter}`}</h3>
              <p>{s.body}</p>
              <p>{s.note}</p>
            </li>
          ))}
        </ul>
      </noscript>

      <div className="flex items-center justify-center gap-3 md:justify-start">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Schermata precedente"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-trama-line bg-white text-trama-navy"
        >
          <i className="ti ti-chevron-left text-[18px]" aria-hidden="true" />
        </button>
        <span className="min-w-[44px] text-center text-[13px] font-semibold tabular-nums text-ink-2">
          {index + 1} / {n}
        </span>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Schermata successiva"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-trama-line bg-white text-trama-navy"
        >
          <i className="ti ti-chevron-right text-[18px]" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
