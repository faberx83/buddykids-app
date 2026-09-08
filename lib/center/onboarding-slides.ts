// TRAMA — Partner Onboarding Carousel: dati PURI delle 4 slide, separati dal
// componente di rendering (components/center/OnboardingCarousel.tsx) per lo
// stesso motivo del carousel Parent (lib/nextgen/onboarding-slides.ts):
// testabile senza browser, un solo file sorgente per la copy.
//
// FINAL PRE-FREEZE WAVE (sez. 22, 08/09/2026) — carousel NUOVO (non esisteva
// alcun equivalente Partner prima di questa wave, vedi audit in
// TRAMA_CURRENT_STATE_ADDENDUM). Copy verbatim dalla specifica di questa
// wave. Stesso motore/persistenza del carousel Parent (RIUSO, non un
// sistema parallelo): un solo step sentinella "carousel" del tutorial
// "partner_beta_onboarding" (lib/walkthrough/registry.ts), stesse Server
// Action generiche di app/actions/walkthrough.ts.
//
// Regole di contenuto (stesse invarianti del carousel Parent): nessuno
// scoring/AI ranking non reale, nessuna menzione di pagamento/checkout/
// carta/transazione, e gli esiti di una richiesta (Slide 3) devono restare
// i 4 realmente esistenti nel prodotto — Accetta, Rifiuta, Conferma
// parziale, Lista d'attesa — mai semplificati a "Accetta/Rifiuta" soltanto,
// che sarebbe un downgrade rispetto a una capability già reale (vedi Fix 1
// "conferma parziale" e Fix 2 "lista d'attesa" nel Current State Addendum).

export type PartnerOnboardingSlideVisual = "bridge" | "offer" | "request" | "lifecycle";

export interface PartnerOnboardingSlide {
  key: string;
  progress: string; // "1/4" .. "4/4"
  title: string;
  body: string;
  microCopy?: string;
  ctaLabel: string;
  visual: PartnerOnboardingSlideVisual;
}

export const PARTNER_ONBOARDING_SLIDES: PartnerOnboardingSlide[] = [
  {
    key: "bridge",
    progress: "1/4",
    title: "TRAMA non sostituisce il tuo gestionale.",
    body: "Collega la tua offerta alla settimana delle famiglie.",
    ctaLabel: "Continua",
    visual: "bridge",
  },
  {
    key: "offer",
    progress: "2/4",
    title: "Decidi tu cosa offrire.",
    body: "Attività, periodo, settimana intera o giorni spot, prezzo, posti disponibili, servizi extra: ogni dettaglio resta sotto il tuo controllo.",
    ctaLabel: "Continua",
    visual: "offer",
  },
  {
    key: "request",
    progress: "3/4",
    title: "Ogni richiesta arriva con il suo contesto.",
    body: "Settimana intera oppure giorni singoli: rispondi con l'esito giusto per ogni caso.",
    microCopy: "Accetta · Rifiuta · Conferma parziale · Lista d'attesa",
    ctaLabel: "Continua",
    visual: "request",
  },
  {
    key: "lifecycle",
    progress: "4/4",
    title: "Il lavoro non finisce quando accetti.",
    body: "Dalla prenotazione alla disponibilità, dal check-in al Registro presenze, fino agli insight sull'andamento del centro.",
    ctaLabel: "Configura il tuo centro",
    visual: "lifecycle",
  },
];

// Dati demo FITTIZI (mai reali) usati solo nelle illustrazioni delle slide.
export const PARTNER_ONBOARDING_OFFER_ITEMS = [
  "Attività",
  "Periodo",
  "Settimana / Giorni spot",
  "Prezzo",
  "Posti",
  "Servizi",
] as const;

export const PARTNER_ONBOARDING_REQUEST_OUTCOMES = [
  { label: "Accetta", icon: "ti-circle-check-filled", className: "bg-trama-green/15 text-trama-green" },
  { label: "Rifiuta", icon: "ti-circle-x-filled", className: "bg-trama-error-light text-trama-error" },
  { label: "Conferma parziale", icon: "ti-circle-half-2", className: "bg-trama-orange/15 text-trama-orange" },
  { label: "Lista d'attesa", icon: "ti-clock-hour-4", className: "bg-trama-lilac/25 text-trama-violet" },
] as const;

export const PARTNER_ONBOARDING_LIFECYCLE_STAGES = [
  "Prenotazione",
  "Disponibilità",
  "Check-in",
  "Registro presenze",
  "Insight",
] as const;
