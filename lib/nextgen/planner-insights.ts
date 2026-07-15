// SPRINT 3 (NEXTGEN) — "Planner" come cuore dell'esperienza: oltre a
// copertura/settimane scoperte (già in lib/data/planner.ts, INVARIATO), serve
// rilevare le SOVRAPPOSIZIONI reali (lo stesso bambino prenotato in due
// attività diverse nella STESSA settimana fisica) e un riepilogo di spesa.
//
// Scelta tecnica importante: SeasonWeek.coveredKids (lib/data/planner.ts) fa
// dedup per bambino per settimana (un bambino compare una sola volta, con la
// PRIMA attività trovata) — comportamento storico, usato da LEGACY
// (PlannerView) e da NEXTGEN Sprint 1, che non va cambiato: altererebbe la
// UI di entrambi (rischio di regressione esplicitamente escluso da
// Fabrizio). Un vero doppio-impegno dello stesso bambino sulla stessa
// settimana andrebbe quindi silenziosamente perso se lo calcolassimo da lì.
// Per questo le sovrapposizioni si calcolano QUI, da zero, direttamente dai
// dati grezzi già disponibili in MyBooking (weekIds/kidIds/kidNames — da
// lib/data/my-bookings.ts, anch'esso INVARIATO): due prenotazioni attive
// dello stesso bambino che condividono lo stesso weekId reale sono, per
// definizione, una sovrapposizione — nessuna nuova query al DB.

import { MyBooking } from "@/lib/data/my-bookings";
import { Activity, Kid, KidGender } from "@/lib/types";
import { PlannerData, SeasonWeek } from "@/lib/data/planner";

export interface KidOverlap {
  kidId: string;
  kidName: string;
  weekId: string;
  weekLabel: string;
  bookings: { bookingId: string; activityName: string }[];
}

// SPRINT CORRETTIVO (Organizzazione) — estratta da PlannerClient.tsx: serve
// anche a lib/nextgen/reminders.ts per collegare il promemoria di
// sovrapposizione alla stessa settimana della Timeline (azione "week").
export function weekIndexFromLabel(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : null;
}

// SPRINT CORRETTIVO — azione associata a un banner (Promemoria/Missione):
// dove porta il click, senza che PlannerClient debba conoscere i dettagli
// di ogni singolo tipo di alert.
export type AlertAction =
  | { type: "week"; index: number }
  | { type: "mode"; mode: "budget" }
  | { type: "link"; href: string };

// BUGFIX (segnalato da Fabrizio) — "risulta prenotato" era hardcoded al
// maschile, sbagliato per una bambina. Kid.gender è opzionale: se assente o
// "altro" si resta sul maschile (default non marcato in italiano), solo "F"
// esplicito passa al femminile.
export function overlapVerb(gender?: KidGender): "prenotato" | "prenotata" {
  return gender === "F" ? "prenotata" : "prenotato";
}

// BUGFIX (segnalato da Fabrizio) — "Laboratorio Arti Creative e Laboratorio
// Arti Creative" (due prenotazioni distinte sulla stessa attività) era
// leggibile male: raggruppa i nomi identici con un contatore ("2× Nome").
export function formatBookingNames(names: string[]): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const n of names) {
    if (!counts.has(n)) order.push(n);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return order.map((n) => ((counts.get(n) ?? 1) > 1 ? `${counts.get(n)}× ${n}` : n)).join(" e ");
}

export function computeKidOverlaps(bookings: MyBooking[]): KidOverlap[] {
  const active = bookings.filter((b) => b.status !== "cancelled");

  // Chiave "kidId__weekId" -> prenotazioni attive che coprono quella coppia.
  const map = new Map<string, KidOverlap>();
  for (const b of active) {
    for (const week of b.weeks) {
      b.kidIds.forEach((kidId, i) => {
        const kidName = b.kidNames[i] ?? "";
        const key = `${kidId}__${week.id}`;
        const entry = map.get(key) ?? { kidId, kidName, weekId: week.id, weekLabel: week.label, bookings: [] };
        if (!entry.bookings.some((x) => x.bookingId === b.id)) {
          entry.bookings.push({ bookingId: b.id, activityName: b.activityName });
        }
        map.set(key, entry);
      });
    }
  }

  // Solo le coppie con 2+ prenotazioni DIVERSE sono una vera sovrapposizione
  // (non basta che il bambino sia prenotato: serve che lo sia due volte).
  return Array.from(map.values()).filter((e) => e.bookings.length > 1);
}

export interface KidBudget {
  kidId: string;
  kidName: string;
  amount: number;
}

// SPRINT 5.1 — dettaglio per categoria (Planner, modalità Budget): usa la
// stessa "categoria primaria" già mostrata come badge sulle card attività
// altrove nell'app (activity.tags[0]?.label) — nessuna nuova tassonomia.
export interface CategoryBudget {
  label: string;
  amount: number;
}

export interface BudgetSummary {
  totalSpent: number;
  byKid: KidBudget[];
  byCategory: CategoryBudget[];
  // Speso totale diviso per il numero di settimane STAGIONALI distinte
  // effettivamente coperte da almeno una prenotazione attiva — "quanto
  // spendiamo in media in una settimana in cui facciamo qualcosa", non
  // diviso per le 13 settimane totali (altrimenti la media scenderebbe
  // artificialmente per chi ha organizzato solo poche settimane).
  weeklyAverage: number;
}

// Nota/limite dichiarato: quando una prenotazione copre più bambini insieme
// (stesso importo, stesso booking), l'intero importo viene contato per OGNI
// bambino coinvolto nel dettaglio "per bambino" — nel modello dati attuale
// non esiste uno split del prezzo per singolo figlio all'interno di uno
// stesso booking. totalSpent (il totale di famiglia) resta invece corretto,
// perché somma ogni booking una sola volta. Stesso limite per "per
// categoria": una prenotazione con più settimane/bambini conta per intero
// nella categoria della sua attività.
export function computeBudgetSummary(bookings: MyBooking[], activities: Activity[]): BudgetSummary {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const totalSpent = active.reduce((sum, b) => sum + b.totalAmount, 0);

  const byKidMap = new Map<string, KidBudget>();
  const byCategoryMap = new Map<string, CategoryBudget>();
  const distinctWeekIds = new Set<string>();

  for (const b of active) {
    b.kidIds.forEach((kidId, i) => {
      const kidName = b.kidNames[i] ?? "";
      const entry = byKidMap.get(kidId) ?? { kidId, kidName, amount: 0 };
      entry.amount += b.totalAmount;
      byKidMap.set(kidId, entry);
    });

    const activity = activities.find((a) => a.id === b.activityId);
    const categoryLabel = activity?.tags?.[0]?.label || "Altro";
    const catEntry = byCategoryMap.get(categoryLabel) ?? { label: categoryLabel, amount: 0 };
    catEntry.amount += b.totalAmount;
    byCategoryMap.set(categoryLabel, catEntry);

    for (const w of b.weeks) distinctWeekIds.add(w.id);
  }

  const weeklyAverage = distinctWeekIds.size > 0 ? Math.round(totalSpent / distinctWeekIds.size) : 0;

  return {
    totalSpent,
    byKid: Array.from(byKidMap.values()).sort((a, b) => b.amount - a.amount),
    byCategory: Array.from(byCategoryMap.values()).sort((a, b) => b.amount - a.amount),
    weeklyAverage,
  };
}

// SPRINT 5.1 — copertura per bambino (Planner, modalità Organizzazione):
// "Sofia 7/8 settimane", "Luca 8/8 — tutto organizzato!" (vedi mockup
// condiviso da Fabrizio). Deriva da SeasonWeek.coveredKids, già calcolato da
// lib/data/planner.ts — nessuna nuova query.
export interface KidCoverageSummary {
  kidId: string;
  kidName: string;
  coveredCount: number;
  neededCount: number;
  missingIndexes: number[];
}

export function computePerKidCoverage(planner: PlannerData, kids: Kid[]): KidCoverageSummary[] {
  const neededWeeks = planner.weeks.filter((w) => !w.dismissed);
  return kids.map((kid) => {
    const missingIndexes: number[] = [];
    let coveredCount = 0;
    for (const w of neededWeeks) {
      const isCovered = w.coveredKids.some((c) => c.kidId === kid.id);
      if (isCovered) coveredCount += 1;
      else missingIndexes.push(w.index);
    }
    return {
      kidId: kid.id,
      kidName: kid.name,
      coveredCount,
      neededCount: neededWeeks.length,
      missingIndexes,
    };
  });
}

// Stesso algoritmo "settimana prioritaria" già in components/PlannerView.tsx
// (LEGACY, richiesto da Fabrizio: preferire un "buco" — scoperta ma con
// almeno una settimana coperta prima E dopo — perché rompe una continuità
// già prenotata ed è la più urgente da sistemare). Duplicato qui di proposito
// invece di essere estratto da PlannerView (componente client "use client" di
// LEGACY, non un modulo lib): stessa regola, zero rischio di toccare
// PlannerView.
export function computePriorityWeekIndex(
  weeks: { index: number; covered: boolean; dismissed: boolean }[]
): number | null {
  const neededUncovered = weeks.filter((w) => !w.covered && !w.dismissed);
  if (neededUncovered.length === 0) return null;

  const coveredBefore = (idx: number) => weeks.some((w) => w.index < idx && w.covered);
  const coveredAfter = (idx: number) => weeks.some((w) => w.index > idx && w.covered);
  const gap = neededUncovered.find((w) => coveredBefore(w.index) && coveredAfter(w.index));
  return (gap ?? neededUncovered[0]).index;
}

// SPRINT CORRETTIVO (feedback Fabrizio, mockup "2. Calendario") — riepilogo
// "Stato per settimana": una striscia compatta di barre colorate, una per
// settimana, per capire a colpo d'occhio l'andamento della stagione senza
// scorrere l'intera Timeline. Stessa classificazione già usata (in modo
// sparso, solo per il colore di sfondo) nella riga della Timeline di
// PlannerClient.tsx — estratta qui come funzione pura riusabile, cosi la
// striscia compatta e la Timeline restano sempre coerenti fra loro.
export type WeekStatus = "dismissed" | "covered" | "partial" | "conflict" | "priority" | "uncovered";

export function computeWeekStatus(
  week: { covered: boolean; dismissed: boolean; coveredKids: { kidId: string }[] },
  totalKids: number,
  hasOverlap: boolean,
  isPriority: boolean
): WeekStatus {
  if (week.dismissed) return "dismissed";
  if (week.covered) {
    if (hasOverlap) return "conflict";
    if (totalKids > 1 && week.coveredKids.length > 0 && week.coveredKids.length < totalKids) return "partial";
    return "covered";
  }
  return isPriority ? "priority" : "uncovered";
}

export const WEEK_STATUS_BAR_CLASS: Record<WeekStatus, string> = {
  dismissed: "bg-ink-3/25",
  covered: "bg-green",
  partial: "bg-trama-orange",
  conflict: "bg-[#E8543E]",
  priority: "bg-trama-violet",
  uncovered: "bg-[#EEF0F4]",
};

// SPRINT 2 (Organizzazione, feedback Fabrizio: "la Timeline potrebbe
// raggruppare le 13 settimane per mese") — stessa convenzione già usata in
// lib/nextgen/missions.ts (w.startDate.slice(0, 7) come chiave mese, array
// MONTH_LABELS_IT duplicato di proposito: piccola funzione pura, zero
// rischio di toccare un modulo condiviso).
const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "";
  return MONTH_LABELS_IT[m - 1];
}

export interface WeekMonthGroup {
  monthKey: string; // "2026-06"
  monthLabel: string; // "Giugno"
  weeks: SeasonWeek[];
}

// Raggruppa le settimane stagionali per mese di inizio (w.startDate),
// preservando l'ordine cronologico sia dei mesi che delle settimane al
// loro interno (le settimane arrivano già ordinate da getPlannerData).
export function groupWeeksByMonth(weeks: SeasonWeek[]): WeekMonthGroup[] {
  const groups: WeekMonthGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const w of weeks) {
    const monthKey = w.startDate.slice(0, 7);
    let idx = indexByKey.get(monthKey);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(monthKey, idx);
      groups.push({ monthKey, monthLabel: monthLabelFromKey(monthKey), weeks: [] });
    }
    groups[idx].weeks.push(w);
  }
  return groups;
}
