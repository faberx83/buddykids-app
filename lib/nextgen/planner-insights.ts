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

export interface KidOverlap {
  kidId: string;
  kidName: string;
  weekId: string;
  weekLabel: string;
  bookings: { bookingId: string; activityName: string }[];
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

export interface BudgetSummary {
  totalSpent: number;
  byKid: KidBudget[];
}

// Nota/limite dichiarato: quando una prenotazione copre più bambini insieme
// (stesso importo, stesso booking), l'intero importo viene contato per OGNI
// bambino coinvolto nel dettaglio "per bambino" — nel modello dati attuale
// non esiste uno split del prezzo per singolo figlio all'interno di uno
// stesso booking. totalSpent (il totale di famiglia) resta invece corretto,
// perché somma ogni booking una sola volta.
export function computeBudgetSummary(bookings: MyBooking[]): BudgetSummary {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const totalSpent = active.reduce((sum, b) => sum + b.totalAmount, 0);

  const byKidMap = new Map<string, KidBudget>();
  for (const b of active) {
    b.kidIds.forEach((kidId, i) => {
      const kidName = b.kidNames[i] ?? "";
      const entry = byKidMap.get(kidId) ?? { kidId, kidName, amount: 0 };
      entry.amount += b.totalAmount;
      byKidMap.set(kidId, entry);
    });
  }

  return {
    totalSpent,
    byKid: Array.from(byKidMap.values()).sort((a, b) => b.amount - a.amount),
  };
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
