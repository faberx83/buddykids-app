// TRAMA — Parent Private Beta Onboarding Carousel: dati PURI delle 5 slide,
// separati dal componente di rendering (components/nextgen/
// OnboardingCarousel.tsx) apposta per essere testabili senza un browser
// (stesso principio "no browser" già usato per lib/data/planner.ts#
// firstUncoveredWeekIndex, vedi tests/one/planner-first-uncovered.spec.ts).
//
// FINAL PRE-FREEZE WAVE (sez. 21, 08/09/2026) — copy sostituita INTEGRALMENTE
// con quella data verbatim da Fabrizio in questa wave (5 schermate, stesso
// numero di prima, stesso motore/persistenza invariati). La versione
// precedente (approvata a sua volta da un pptx di riferimento, vedi
// TRAMA_PARENT_ONBOARDING_IMPLEMENTATION.md per la nota di trasparenza
// storica) è sostituita, non affiancata — un solo carousel canonico.
//
// Regole di contenuto EREDITATE dalla versione precedente (invarianti di
// prodotto, non solo di questo giro di copy — vedi TRAMA_PLATFORM_PRODUCT_
// TRUTH.md): nessuna slide deve mai contenere "Match 99%" o altro scoring/
// AI ranking non ancora una capability reale, nessuna menzione di pagamento/
// checkout/carta/transazione (il Golden Path si ferma alla richiesta, mai al
// pagamento), e "prenotato" non deve mai essere presentato come sinonimo di
// "confermato" senza qualificazione — coerente con la Slide 4 di questo giro
// che mostra esplicitamente lo STATO (prenotazione · disponibilità ·
// aggiornamenti) come una tappa distinta, non implicita.
//
// Verificato dai test [no browser] in tests/nextgen/onboarding-carousel.spec.ts
// (aggiornati in questa stessa wave per la nuova copy).

export type OnboardingSlideVisual = "chaos" | "search" | "responsibility" | "flow" | "share";

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
    key: "scattered",
    progress: "1/5",
    title: "Le attività dei tuoi figli sono sparse.",
    body: "Le loro settimane non devono esserlo.",
    ctaLabel: "Continua",
    visual: "chaos",
  },
  {
    key: "gap",
    progress: "2/5",
    title: "Quando resta un buco, TRAMA ti aiuta a riempirlo.",
    body: "Cerca tra le attività compatibili con i tuoi figli e con la settimana ancora da organizzare.",
    microCopy: "Attività · Centro · Distanza · Servizi · Disponibilità",
    ctaLabel: "Continua",
    visual: "search",
  },
  {
    key: "organized",
    progress: "3/5",
    title: "Prenotato non significa ancora organizzato.",
    body: "Ogni settimana ha anche una logistica da decidere.",
    microCopy: "Chi lo porta? · Chi lo riprende?",
    ctaLabel: "Continua",
    visual: "responsibility",
  },
  {
    key: "from-center-to-day",
    progress: "4/5",
    title: "Dal centro alla giornata.",
    body: "Dalla scheda del centro fino al check-in del giorno stesso, tutto resta collegato.",
    ctaLabel: "Continua",
    visual: "flow",
  },
  {
    key: "share",
    progress: "5/5",
    title: "Condividi. Coordina. Intreccia.",
    body: "Altro genitore, nonni, tata, gruppi: lo stesso piano, visibile a chi serve.",
    ctaLabel: "Inizia a organizzare",
    visual: "share",
  },
];

// Dati demo FITTIZI (mai reali) usati solo nelle illustrazioni delle slide.
export const ONBOARDING_DEMO_KIDS = ["Sofia", "Luca"] as const;
export const ONBOARDING_DEMO_ACTIVITIES_CHAOS = ["Nuoto", "Nonni", "Centro estivo", "Danza"] as const;
export const ONBOARDING_DEMO_CENTER = "Centro Demo Aurora";
export const ONBOARDING_DEMO_ACTIVITY_SEARCH = "Estate Sport — Demo";
export const ONBOARDING_DEMO_WEEK_LABEL = "Libero in SETT. 15";

// Slide 3 (Chi fa cosa) — Andata/Ritorno per un bambino demo, stesso
// principio "mai dati reali" delle altre slide.
export const ONBOARDING_DEMO_RESPONSIBILITY: { kid: string; andata: string; ritorno: string } = {
  kid: "Sofia",
  andata: "Mamma",
  ritorno: "Tata",
};

// Slide 4 (Dal centro alla giornata) — le 4 tappe del flusso, con i
// sotto-elementi indicati esplicitamente nella specifica di questo giro.
export const ONBOARDING_FLOW_STAGES: { label: string; icon: string; items: string[] }[] = [
  { label: "Centro", icon: "ti-building", items: ["Sede", "Servizi", "Informazioni"] },
  { label: "Stato", icon: "ti-clipboard-check", items: ["Prenotazione", "Disponibilità", "Aggiornamenti"] },
  { label: "Logistica", icon: "ti-map-pin", items: ["Dove", "Quando", "Chi"] },
  { label: "Presenza", icon: "ti-user-check", items: ["Check-in", "Presenze"] },
];

// Slide 5 (Condividi) — persone/canali con cui un piano può essere
// condiviso, dati fittizi coerenti con le capability reali (Chi fa cosa,
// Gruppi, Piano condiviso) — mai un elenco di feature inventate.
export const ONBOARDING_SHARE_PEOPLE = ["Altro genitore", "Nonni", "Tata", "Gruppo"] as const;
