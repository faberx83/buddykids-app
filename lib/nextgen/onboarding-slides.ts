// TRAMA — Onboarding famiglie: dati PURI delle slide, separati dal componente
// di rendering (components/nextgen/OnboardingCarousel.tsx) per essere
// testabili senza browser (tests/nextgen/onboarding-carousel.spec.ts).
//
// FAMILY-FIRST BETA PASS (07/10/2026) — nuova versione approvata da Fabrizio
// sull'anteprima animata (fondo bianco, telefono 3D leggero, card che escono
// dal telefono). Quattro schermate: Scopri → Organizza → Coordina → Insieme.
// Principio: TRAMA è utile anche quando i centri della famiglia non sono su
// TRAMA. Sostituisce la versione a 5 slide del 08/09 ("Le attività dei tuoi
// figli sono sparse…", "Dal centro alla giornata"), non la affianca.
//
// Nuova chiave di tutorial (non più "parent_beta_onboarding"): chi aveva già
// completato o saltato la versione precedente vede quella nuova UNA volta al
// prossimo accesso — scelta voluta, il posizionamento è cambiato.
//
// Regole di contenuto (invariate): nessuno scoring/AI ranking ("Match 99%"),
// nessun pagamento/checkout, nessuna funzione futura presentata come
// disponibile (le deleghe compaiono solo con l'etichetta "In arrivo"). Dati
// demo SEMPRE fittizi, mai dati reali dell'utente.

export const PARENT_ONBOARDING_TUTORIAL_KEY = "family_first_onboarding";
export const PARENT_ONBOARDING_STEP_KEY = "carousel";

export type OnboardingSlideVisual = "discover" | "organize" | "coordinate" | "together";

export interface OnboardingPop {
  /** Icona Tabler (classe "ti-…"). */
  icon: string;
  tone: "violet" | "green" | "amber";
  title: string;
  subtitle: string;
  /** Etichetta "In arrivo" accanto al titolo (funzione non ancora disponibile). */
  comingSoon?: boolean;
  side: "left" | "right";
  /** Posizione verticale nel palco, in percentuale. */
  top: number;
}

export interface OnboardingSlide {
  key: string;
  progress: string; // "1/4" .. "4/4"
  eyebrow: string;
  /** Titolo diviso in tre parti: la parte centrale è evidenziata. */
  titleBefore: string;
  titleHighlight: string;
  titleAfter: string;
  body: string;
  note: string;
  ctaLabel: string;
  visual: OnboardingSlideVisual;
  /** Inclinazione del telefono (gradi) per questa slide. */
  tilt: { y: number; x: number };
  pops: [OnboardingPop, OnboardingPop];
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: "discover",
    progress: "1/4",
    eyebrow: "Scopri",
    titleBefore: "Trova attività ",
    titleHighlight: "giuste",
    titleAfter: " per i tuoi figli.",
    body: "Sport, musica, centri estivi: cerca per età, zona e settimana, e salva quello che ti interessa.",
    note: "Anche quando il centro non è ancora su TRAMA.",
    ctaLabel: "Continua",
    visual: "discover",
    tilt: { y: -14, x: 6 },
    pops: [
      { icon: "ti-circle-check-filled", tone: "violet", title: "Su TRAMA", subtitle: "gestita dal centro, prenoti qui", side: "left", top: 20 },
      { icon: "ti-heart-filled", tone: "green", title: "Scoperta TRAMA", subtitle: "la salvi e la organizzi comunque", side: "right", top: 60 },
    ],
  },
  {
    key: "organize",
    progress: "2/4",
    eyebrow: "Organizza",
    titleBefore: "Tutto nello ",
    titleHighlight: "stesso",
    titleAfter: " Planner.",
    body: "Attività prenotate su TRAMA, corsi trovati altrove e impegni di famiglia: una sola settimana da guardare.",
    note: "Quello che non trovi, lo aggiungi tu in pochi secondi.",
    ctaLabel: "Continua",
    visual: "organize",
    tilt: { y: 12, x: 5 },
    pops: [
      { icon: "ti-plus", tone: "green", title: "Calcio · mar 17:00", subtitle: "aggiunto da te", side: "right", top: 16 },
      { icon: "ti-confetti", tone: "amber", title: "Festa di Sofia", subtitle: "sabato · 16:00", side: "left", top: 66 },
    ],
  },
  {
    key: "coordinate",
    progress: "3/4",
    eyebrow: "Coordina",
    titleBefore: "Chi porta, ",
    titleHighlight: "chi riprende.",
    titleAfter: "",
    body: "Aggiungi chi ti aiuta (l'altro genitore, i nonni, la tata) e decidi andate e ritorni di ogni giornata.",
    note: "Indirizzi e promemoria restano nel Planner.",
    ctaLabel: "Continua",
    visual: "coordinate",
    tilt: { y: -8, x: 4 },
    pops: [
      { icon: "ti-arrows-exchange", tone: "violet", title: "Riprende Nonna Rita", subtitle: "Luca · 18:15", side: "left", top: 22 },
      { icon: "ti-shield-check", tone: "amber", title: "Deleghe smart", subtitle: "ritiro sicuro, senza carta", comingSoon: true, side: "right", top: 66 },
    ],
  },
  {
    key: "together",
    progress: "4/4",
    eyebrow: "Insieme",
    titleBefore: "Fate rete con ",
    titleHighlight: "altre famiglie.",
    titleAfter: "",
    body: "Crea un gruppo con le famiglie dei compagni, invitale con un link e condividi il piano con chi vuoi.",
    note: "TRAMA è in beta: dicci cosa ti serve, la costruiamo con te.",
    ctaLabel: "Inizia a organizzare",
    visual: "together",
    tilt: { y: 10, x: 5 },
    pops: [
      { icon: "ti-user-check", tone: "green", title: "Famiglia Rossi", subtitle: "ha accettato l'invito", side: "right", top: 18 },
      { icon: "ti-share", tone: "violet", title: "Piano condiviso", subtitle: "con Nonna Rita e Tata Giulia", side: "left", top: 66 },
    ],
  },
];

// Dati demo FITTIZI usati solo dentro le schermate del telefono.
export const ONBOARDING_DEMO_KIDS = ["Sofia", "Luca"] as const;

export const ONBOARDING_DEMO_DISCOVER = {
  heading: "Per Sofia, 7 anni",
  query: "Sport vicino a casa",
  filters: ["Sport", "Musica", "Estate"],
  partner: { emoji: "⚽", name: "Estate Sport Demo", meta: "Centro Demo Aurora · 1,2 km", cta: "Prenota" },
  curated: { emoji: "🏊", name: "Nuoto bambini", meta: "Piscina Demo · 2,4 km", cta: "Aggiungi al Planner" },
} as const;

export const ONBOARDING_DEMO_WEEK = {
  heading: "Settimana 13–17 ott",
  days: [
    { label: "L", day: "13" },
    { label: "M", day: "14", active: true },
    { label: "M", day: "15" },
    { label: "G", day: "16" },
    { label: "V", day: "17" },
  ],
  items: [
    { time: "08:30 – 16:00", name: "Doposcuola Demo", source: "Su TRAMA · confermato", tone: "violet" },
    { time: "17:00 – 18:15", name: "Calcio · Luca", source: "Aggiunto da te", tone: "green" },
    { time: "18:30", name: "Dentista · Sofia", source: "Impegno di famiglia", tone: "amber" },
    { time: "Gio 16:30", name: "Pianoforte · Sofia", source: "Trovato in Scopri", tone: "green" },
  ],
} as const;

export const ONBOARDING_DEMO_RESPONSIBILITY = {
  heading: "Martedì 14 ottobre",
  helpers: ["M", "P", "R", "G"],
  rows: [
    { kid: "Sofia", activity: "Dentista", porta: "Mamma", riprende: "Mamma" },
    { kid: "Luca", activity: "Calcio", porta: "Papà", riprende: "Nonna Rita" },
  ],
} as const;

export const ONBOARDING_DEMO_GROUPS = {
  heading: "Andiamo insieme",
  groups: [
    { name: "Calcio Under 8", meta: "4 famiglie · stesso corso del martedì", members: ["A", "B", "C"], cta: "Invita una famiglia" },
    { name: "Centro estivo 2027", meta: "2 famiglie · valutate insieme", members: ["D", "E"] },
  ],
  shared: { name: "Piano condiviso", meta: "Link per nonni e tata, anche senza account" },
} as const;
