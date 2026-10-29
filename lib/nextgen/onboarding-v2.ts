// TRAMA — ONBOARDING V2 (14/10/2026, piano unito approvato da Fabrizio).
// Dati PURI dell'onboarding V2 (testati in tests/one/onboarding-v2.spec.ts),
// separati dal componente components/nextgen/OnboardingV2.tsx.
//
// Percorso:
//   1-3. tre schermate "perché" (testi proposti da ChatGPT, visual animati):
//        Tutto in un posto → Anche se il centro non è su TRAMA → Non solo
//        cosa, anche chi. CTA dell'ultima: "Inizia a organizzare".
//   4.   I tuoi figli (se non ce n'è nessuno si aggiunge qui; se ci sono si
//        conferma e si va avanti).
//   5.   La scuola: Regione e Comune per il calendario ("Lo faccio dopo").
//        Saltata se il calendario scolastico non è attivo per l'account, se
//        non ci sono figli o se la scuola è già impostata per tutti.
//   6.   La Home.
// Dietro ONBOARDING_V2_ENABLED; chiave tutorial NUOVA (family_onboarding_v2):
// si vede una volta, anche da chi aveva già visto l'onboarding attuale.
// Dati demo dei visual SEMPRE fittizi, mai dati reali dell'utente.

export const ONBOARDING_V2_TUTORIAL_KEY = "family_onboarding_v2";
export const ONBOARDING_V2_STEP_KEY = "carousel";

export type OnboardingV2Visual = "oggi" | "fuori" | "chi";

export interface OnboardingV2Pop {
  icon: string;
  tone: "navy" | "green" | "amber" | "coral";
  title: string;
  subtitle?: string;
  /** Da che lato del telefono esce la card. */
  side: "left" | "right";
  /** Posizione verticale nel palco, in percentuale. */
  top: number;
  /**
   * NODI THREAD (29/10/2026, Fabrizio: "nelle slide mettilo più grande"):
   * con NODI_ENABLED questa card mostra Nodi al posto dell'icona. Solo nella
   * schermata "chi": il nodo (manca chi ritira) e il nodo sciolto (risolto).
   */
  nodi?: "problem" | "success";
}

export interface OnboardingV2Slide {
  key: OnboardingV2Visual;
  eyebrow: string;
  title: string;
  /** Parte del titolo evidenziata (deve comparire in `title`). */
  highlight: string;
  body: string;
  ctaLabel: string;
  /** Inclinazione del telefono (gradi) per questa schermata: ruota tra una e l'altra. */
  tilt: { y: number; x: number };
  pops: [OnboardingV2Pop, OnboardingV2Pop];
}

export const ONBOARDING_V2_SLIDES: OnboardingV2Slide[] = [
  {
    key: "oggi",
    eyebrow: "Benvenuto in TRAMA",
    title: "Tutto quello che fanno i tuoi figli, in un posto.",
    highlight: "in un posto.",
    body: "Scuola, sport, centri estivi e impegni di famiglia: una sola settimana da guardare.",
    ctaLabel: "Continua",
    tilt: { y: -14, x: 6 },
    pops: [
      { icon: "ti-plus", tone: "green", title: "Calcio · mar 17:00", subtitle: "aggiunto da te", side: "right", top: 16 },
      { icon: "ti-circle-check", tone: "navy", title: "Settimana organizzata", side: "left", top: 66 },
    ],
  },
  {
    key: "fuori",
    eyebrow: "Organizza",
    title: "Anche se il centro non è su TRAMA.",
    highlight: "non è su TRAMA.",
    body: "Il corso di calcio, la piscina, il dentista: li aggiungi tu in pochi secondi e stanno nel Planner con il resto.",
    ctaLabel: "Continua",
    tilt: { y: 12, x: 5 },
    pops: [
      { icon: "ti-pencil-plus", tone: "green", title: "Aggiunto da te", subtitle: "in 10 secondi", side: "left", top: 42 },
      { icon: "ti-calendar-check", tone: "navy", title: "Nel Planner", subtitle: "martedì 17:00", side: "right", top: 72 },
    ],
  },
  {
    key: "chi",
    eyebrow: "Coordina",
    title: "Non solo cosa. Anche chi.",
    highlight: "Anche chi.",
    body: "Chi porta e chi ritira, giorno per giorno: tu, l'altro genitore, i nonni o la tata. Se manca qualcuno, TRAMA te lo dice.",
    ctaLabel: "Inizia a organizzare",
    tilt: { y: -8, x: 4 },
    pops: [
      { icon: "ti-alert-circle", tone: "amber", title: "Manca chi ritira", subtitle: "Lino · gio 18:00", side: "right", top: 14, nodi: "problem" },
      { icon: "ti-check", tone: "green", title: "Ritira Nonna Rita", subtitle: "risolto", side: "left", top: 68, nodi: "success" },
    ],
  },
];

/** Dati demo FITTIZI dentro i visual. */
export const ONBOARDING_V2_DEMO = {
  oggi: {
    heading: "Oggi",
    date: "mer 14 ottobre",
    items: [
      { time: "16:45", name: "Nuoto", meta: "Sofia · Piscina Demo", tone: "#2DBA8C" },
      { time: "17:00", name: "Ginnastica", meta: "Lino · Palestra Demo", tone: "#F6A623", who: "Porta tu · Ritira Marco" },
    ],
  },
  fuori: {
    heading: "Un impegno",
    fields: [
      { label: "Cosa", value: "Calcio" },
      { label: "Per", value: "Lino" },
      { label: "Quando", value: "Martedì · 17:00–18:15" },
      { label: "Dove", value: "Campo sportivo Demo" },
    ],
    cta: "Aggiungi al Planner",
  },
  chi: {
    heading: "Giovedì",
    rows: [
      { kid: "Lino", porta: "Tu", riprende: null as string | null },
      { kid: "Sofia", porta: "Nonna Rita", riprende: "Marco" },
    ],
  },
} as const;

/**
 * Interessi proposti nel passo "I tuoi figli". Il valore salvato è lo stesso
 * formato di AddKidForm (emoji + etichetta, da lib/mock-data.ts#categories),
 * così il matching delle attività non cambia; a schermo solo l'etichetta.
 */
export const ONBOARDING_V2_INTERESTS: { value: string; label: string }[] = [
  { value: "⚽ Sport", label: "Sport" },
  { value: "🏊 Piscina", label: "Piscina" },
  { value: "🎵 Musica", label: "Musica" },
  { value: "🎨 Arte", label: "Arte" },
  { value: "💃 Danza", label: "Danza" },
  { value: "🌿 Natura", label: "Natura" },
  { value: "🔬 STEM", label: "STEM" },
];

export type OnboardingV2Phase = "perche" | "figli" | "scuola";

/**
 * Passi di preparazione dopo "Inizia a organizzare". I figli si chiedono
 * sempre (con figli già inseriti è una conferma veloce); la scuola solo se
 * il calendario scolastico è attivo, ci sono figli e manca per qualcuno.
 */
export function onboardingV2SetupPhases(input: {
  kidsCount: number;
  schoolCalendarEnabled: boolean;
  kidsWithoutSchoolCount: number;
}): OnboardingV2Phase[] {
  const phases: OnboardingV2Phase[] = ["figli"];
  if (input.schoolCalendarEnabled && input.kidsCount > 0 && input.kidsWithoutSchoolCount > 0) phases.push("scuola");
  return phases;
}

/** Dopo i figli: la scuola va proposta con i figli appena aggiunti. */
export function shouldAskSchool(input: { schoolCalendarEnabled: boolean; kidsCount: number; kidsWithoutSchoolCount: number }): boolean {
  return input.schoolCalendarEnabled && input.kidsCount > 0 && input.kidsWithoutSchoolCount > 0;
}

/** Età in anni da una data di nascita ISO (giorno compreso). */
export function ageFromIso(birthDate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= 0 && age < 30 ? age : null;
}
