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

function ageScore(kidAge: number, ageRange: string): number {
  const parsed = parseAgeRange(ageRange);
  if (!parsed) return 25; // fascia età non leggibile: punteggio neutro
  const [min, max] = parsed;
  if (kidAge >= min && kidAge <= max) return 50;
  const distance = kidAge < min ? min - kidAge : kidAge - max;
  return Math.max(0, 50 - distance * 15);
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
  const total = ageScore(kid.age, activity.ageRange) + interestScore(kid, activity) + ratingScore(activity);
  return Math.max(0, Math.min(99, Math.round(total)));
}

export function computeMatchesForKid(kid: Kid, activities: Activity[]): MatchedActivity[] {
  return activities
    .map((a) => ({ ...a, matchPercent: matchPercentForKid(kid, a) }))
    .sort((a, b) => b.matchPercent - a.matchPercent);
}
