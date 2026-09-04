// Calcolo del "match %" tra un bambino e le attività, per la vista Home
// "Per bambino". È un algoritmo interim, non un vero motore di raccomandazione:
// combina fascia d'età (dato reale), sovrapposizione testuale tra gli interessi
// del bambino e i tag/nome dell'attività (dato reale), e un piccolo bonus legato
// al rating (dato reale). Nessun numero è inventato: tutto deriva da campi già
// presenti nei dati di bambino/attività. Da rivedere quando si vorrà un vero
// motore di raccomandazione (es. basato su prenotazioni passate).

import { Activity, Kid } from "@/lib/types";

export interface MatchedActivity extends Activity {
  matchPercent: number;
}

function parseAgeRange(ageRange: string): [number, number] | null {
  const match = ageRange.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

// FIX (TRAMA FINAL HARDENING §18, segnalazione live 04/09/2026: un bambino
// di 4 anni su un'attività dichiarata 6-12 anni mostrava "Match 65%" +
// "Piace a [bambino]") — root cause: questo punteggio era un decadimento
// morbido (Math.max(0, 50 - distanza*15)), MAI un taglio netto — a distanza
// 2 restituiva ancora 20 punti, che sommati a interessi/rating potevano
// facilmente superare qualunque soglia di "buon match". "HARD" per
// esplicita richiesta: fuori range = ZERO, nessun punteggio parziale che
// possa far apparire un'attività age-incompatibile come "quasi adatta".
// isAgeEligible() è la stessa identica regola, esposta come booleano puro
// per chi ha bisogno del solo giudizio di idoneità (non del punteggio).
export function isAgeEligible(kidAge: number, ageRange: string): boolean {
  const parsed = parseAgeRange(ageRange);
  // Fascia età non leggibile/assente: non possiamo dichiarare
  // un'incompatibilità che i dati non confermano — resta idoneo (nessun
  // hard cutoff senza un dato reale su cui basarlo).
  if (!parsed) return true;
  const [min, max] = parsed;
  return kidAge >= min && kidAge <= max;
}

function ageScore(kidAge: number, ageRange: string): number {
  const parsed = parseAgeRange(ageRange);
  if (!parsed) return 25; // fascia età non leggibile: punteggio neutro
  const [min, max] = parsed;
  if (kidAge >= min && kidAge <= max) return 50;
  return 0; // hard cutoff — vedi commento sopra
}

function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove accenti
    .replace(/[^a-z0-9\s]/gu, " ") // rimuove emoji e simboli
    .trim();
}

function interestScore(kid: Kid, activity: Activity): number {
  const interests = (kid.interests ?? []).map(normalizeKeyword).filter(Boolean);
  if (interests.length === 0) return 0;

  const haystack = normalizeKeyword(
    [activity.name, activity.description, ...activity.tags.map((t) => t.label)].join(" ")
  );

  let matches = 0;
  for (const interest of interests) {
    const words = interest.split(/\s+/).filter((w) => w.length >= 3);
    if (words.some((w) => haystack.includes(w))) matches += 1;
  }
  return Math.min(40, matches * 15);
}

function ratingScore(activity: Activity): number {
  return Math.min(10, Math.round(activity.rating * 2));
}

export function matchPercentForKid(kid: Kid, activity: Activity): number {
  // FIX (TRAMA FINAL HARDENING §18) — non basta azzerare SOLO il contributo
  // età (sopra): interessi (fino a 40) + rating (fino a 10) da soli
  // potevano ancora sommare a 50, abbastanza per restare tra i "Perfetti
  // per [bambino]" (top 4, components/PerBambinoView.tsx) o superare la
  // soglia "Piace a [bambino]" (lib/nextgen/smart-search.ts) nonostante
  // l'età fosse realmente incompatibile — "non può MAI essere una
  // raccomandazione per riempire la settimana di quel bambino" richiede lo
  // zero TOTALE, non solo sulla componente età.
  if (!isAgeEligible(kid.age, activity.ageRange)) return 0;
  const total = ageScore(kid.age, activity.ageRange) + interestScore(kid, activity) + ratingScore(activity);
  return Math.max(0, Math.min(99, Math.round(total)));
}

export function computeMatchesForKid(kid: Kid, activities: Activity[]): MatchedActivity[] {
  return activities
    .map((a) => ({ ...a, matchPercent: matchPercentForKid(kid, a) }))
    .sort((a, b) => b.matchPercent - a.matchPercent);
}
