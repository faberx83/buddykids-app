// TRAMA — Parent Private Beta Onboarding Carousel: dati PURI delle 5 slide,
// separati dal componente di rendering (components/nextgen/
// OnboardingCarousel.tsx) apposta per essere testabili senza un browser
// (stesso principio "no browser" già usato per lib/data/planner.ts#
// firstUncoveredWeekIndex, vedi tests/one/planner-first-uncovered.spec.ts).
//
// Fonte visiva/copy: trama-onboarding-private-beta-final.pptx (non presente
// in questo ambiente di sviluppo — copy, titoli, CTA e regole "NON mostrare"
// riportati qui verbatim dalla specifica testuale fornita per questo task,
// vedi TRAMA_PARENT_ONBOARDING_IMPLEMENTATION.md per la nota di trasparenza).
// Titolo Slide 2 è la decisione DEFINITIVA data esplicitamente: "Le tue
// settimane, finalmente visibili" (NON "La tua estate, finalmente visibile").
//
// Regole di contenuto verificate dai test ONB-P08/P09/P10
// (tests/nextgen/onboarding-carousel.spec.ts, [no browser]):
// - Slide 4 deve contenere "In attesa" (la richiesta NON è una prenotazione
//   confermata finché il centro non risponde).
// - Nessuna slide deve mai contenere "Match 99%" o altro scoring/AI ranking
//   non ancora una capability reale e provata del prodotto.
// - Nessuna slide deve mai menzionare pagamento/checkout/carta/transazione:
//   il Golden Path mostrato si ferma alla richiesta, mai al pagamento.

export type OnboardingSlideVisual = "chaos" | "planner" | "search" | "request" | "final";

export interface OnboardingSlide {
  key: string;
  progress: string; // "1/5" .. "5/5"
  title: string;
  body: string;
  microCopy?: string;
  ctaLabel: string;
  visual: OnboardingSlideVisual;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: "chaos",
    progress: "1/5",
    title: "Benvenuto in TRAMA",
    body: "Organizza attività, settimane e impegni dei tuoi figli in un unico posto.",
    ctaLabel: "Continua",
    visual: "chaos",
  },
  {
    key: "planner",
    progress: "2/5",
    // Decisione definitiva del design approvato — non reinterpretare.
    title: "Le tue settimane, finalmente visibili",
    body: "Vedi subito cosa è già organizzato e quali settimane devi ancora riempire.",
    ctaLabel: "Continua",
    visual: "planner",
  },
  {
    key: "search",
    progress: "3/5",
    title: "Trova ciò che serve davvero",
    body: "Cerca attività compatibili con i tuoi figli e con le settimane che devi organizzare.",
    ctaLabel: "Continua",
    visual: "search",
  },
  {
    key: "request",
    progress: "4/5",
    title: "Tu chiedi. Il centro risponde.",
    body: "Invia una richiesta, ricevi la conferma o un'alternativa e ritrova tutto nel Planner.",
    ctaLabel: "Continua",
    visual: "request",
  },
  {
    key: "explore",
    progress: "5/5",
    title: "Adesso prova TRAMA",
    body: "Questa è una Beta privata. Esplora liberamente e raccontaci cosa funziona, cosa manca e dove ti blocchi.",
    microCopy: "Il tuo feedback costruirà la prossima versione.",
    ctaLabel: "Inizia a esplorare",
    visual: "final",
  },
];

// Dati demo FITTIZI (mai reali) usati solo nelle illustrazioni delle slide.
export const ONBOARDING_DEMO_KIDS = ["Sofia", "Luca"] as const;
export const ONBOARDING_DEMO_ACTIVITIES_CHAOS = ["Nuoto", "Nonni", "Centro estivo", "Danza"] as const;
export const ONBOARDING_DEMO_CENTER = "Centro Demo Aurora";
export const ONBOARDING_DEMO_ACTIVITY_SEARCH = "Estate Sport — Demo";
export const ONBOARDING_DEMO_WEEK_LABEL = "Libero in SETT. 15";

// Flow Slide 4 — deve restare inequivocabile: RICHIESTA ≠ PRENOTAZIONE
// CONFERMATA. Esportato come dati (non hardcoded nel JSX) cosi i test [no
// browser] possono verificare la presenza di "In attesa" senza renderizzare.
export const ONBOARDING_REQUEST_FLOW = ["Famiglia", "Richiesta", "In attesa", "Centro", "Risposta", "Planner"] as const;
export const ONBOARDING_REQUEST_OUTCOMES = ["Confermata", "Alternativa"] as const;
