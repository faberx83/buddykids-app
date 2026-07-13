// SPRINT 5.1 (NEXTGEN) — "Missioni": il Planner non deve limitarsi a dire
// cosa manca, deve incorniciare l'organizzazione come piccoli traguardi
// raggiunti/da raggiungere (richiesta di Fabrizio — "non sono gamification,
// sono messaggi che riducono l'ansia e danno un senso di avanzamento").
// Logica pura: nessuna nuova query, riusa PlannerData (lib/data/planner.ts),
// MyBooking (lib/data/my-bookings.ts) e Activity (lib/types.ts) già letti
// dalla pagina Planner.

import { PlannerData } from "@/lib/data/planner";
import { MyBooking } from "@/lib/data/my-bookings";
import { Activity, Kid } from "@/lib/types";

export interface Mission {
  id: string;
  emoji: string;
  text: string;
  tone: "success" | "info";
}

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "";
  return MONTH_LABELS_IT[m - 1];
}

// Stessa normalizzazione di lib/matching.ts (duplicata di proposito, come già
// fatto in planner-insights.ts: piccola funzione pura, zero rischio di
// toccare un modulo condiviso con LEGACY).
function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .trim();
}

function activityMatchesInterest(activity: Activity, interest: string): boolean {
  const haystack = normalizeKeyword(
    [activity.name, activity.description, ...activity.tags.map((t) => t.label)].join(" ")
  );
  const words = normalizeKeyword(interest)
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return words.some((w) => haystack.includes(w));
}

// Missione 1 — "vicino al traguardo di un mese": trova il mese della
// stagione con ESATTAMENTE una settimana ancora scoperta (il gap più facile
// da chiudere, non il primo in ordine cronologico).
function computeMonthMission(planner: PlannerData): Mission | null {
  const byMonth = new Map<string, { label: string; missing: number[] }>();
  for (const w of planner.weeks) {
    if (w.dismissed) continue;
    const monthKey = w.startDate.slice(0, 7);
    const entry = byMonth.get(monthKey) ?? { label: monthLabel(monthKey), missing: [] };
    if (!w.covered) entry.missing.push(w.index);
    byMonth.set(monthKey, entry);
  }
  const closest = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .find(([, v]) => v.missing.length === 1);
  if (!closest) return null;
  const [, { label, missing }] = closest;
  return {
    id: "month-gap",
    emoji: "🎯",
    text: `Ti manca solo la Settimana ${missing[0]} per completare ${label}.`,
    tone: "info",
  };
}

// Missioni 2 — copertura degli interessi dichiarati per bambino: "già tutto
// pianificato" (rassicurante) oppure "manca ancora X" (mirato), UNA per
// bambino con interessi dichiarati, al massimo 2 per non affollare la Home/
// il Planner di messaggi.
function computeInterestMissions(bookings: MyBooking[], activities: Activity[], kids: Kid[]): Mission[] {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const bookedActivities = active
    .map((b) => activities.find((a) => a.id === b.activityId))
    .filter((a): a is Activity => Boolean(a));

  const missions: Mission[] = [];
  for (const kid of kids) {
    const interests = (kid.interests ?? []).filter(Boolean);
    if (interests.length === 0) continue;

    const missing = interests.filter(
      (interest) => !bookedActivities.some((a) => activityMatchesInterest(a, interest))
    );

    if (missing.length === 0) {
      missions.push({
        id: `interests-done-${kid.id}`,
        emoji: "🎉",
        text: `Hai già pianificato tutte le attività che interessano a ${kid.name}.`,
        tone: "success",
      });
    } else if (missing.length === 1) {
      missions.push({
        id: `interests-gap-${kid.id}`,
        emoji: "🎨",
        text: `Manca ancora un'attività di ${missing[0]} per ${kid.name}.`,
        tone: "info",
      });
    }
    if (missions.length >= 2) break;
  }
  return missions;
}

// Combina le missioni disponibili, al massimo 3 (coerente con "piccoli
// obiettivi", non un elenco infinito) — priorità al gap di mese (più
// azionabile), poi agli interessi per bambino.
export function computeMissions(
  planner: PlannerData,
  bookings: MyBooking[],
  activities: Activity[],
  kids: Kid[]
): Mission[] {
  const missions: Mission[] = [];
  const monthMission = computeMonthMission(planner);
  if (monthMission) missions.push(monthMission);
  missions.push(...computeInterestMissions(bookings, activities, kids));
  return missions.slice(0, 3);
}
