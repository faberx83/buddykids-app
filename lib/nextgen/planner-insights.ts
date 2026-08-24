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
//
// BUG CORRETTO 06/08/2026 (segnalato da Fabrizio: "il motore deve sempre
// funzionare in relazione al timestamp reale... le settimane prima devono
// già essere non modificabili") — questa funzione non aveva NESSUNA
// consapevolezza della data odierna: una settimana già passata e mai
// coperta poteva essere segnalata "priorità" (viola) anche se non c'è più
// nulla da poter prenotare per quella settimana. todayIso (opzionale, per
// non rompere eventuali altri chiamanti/test che non lo passano — in quel
// caso il comportamento resta quello di prima, nessuna esclusione)
// esclude le settimane il cui endDate è già trascorso dai candidati a
// "priorità": possono ancora contare come "coperta"/riferimento per il
// calcolo del gap (coveredBefore/coveredAfter restano invariati), ma non
// possono più essere IL risultato restituito.
export function computePriorityWeekIndex(
  weeks: { index: number; covered: boolean; dismissed: boolean; endDate?: string }[],
  todayIso?: string
): number | null {
  const isPast = (w: { endDate?: string }) => Boolean(todayIso && w.endDate && w.endDate < todayIso);
  const neededUncovered = weeks.filter((w) => !w.covered && !w.dismissed && !isPast(w));
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
// BUG CORRETTO 06/08/2026 (segnalato da Fabrizio) — "past" è un nuovo stato:
// una settimana già trascorsa e mai coperta non è più "scoperta" (si può
// ancora prenotare) né tantomeno "priorità" (viola, "occupatene subito") —
// è semplicemente chiusa, non c'è più nulla da poter fare per quella
// settimana specifica.
export type WeekStatus = "dismissed" | "covered" | "partial" | "conflict" | "priority" | "uncovered" | "awaiting" | "past";

export function computeWeekStatus(
  week: {
    covered: boolean;
    dismissed: boolean;
    coveredKids: { kidId: string }[];
    awaitingPartnerConfirmation?: boolean;
    // BUG CORRETTO 06/08/2026 (decisione di Fabrizio): una settimana coperta
    // SOLO da prenotazioni a giorni singoli (booking_days, "Giorni spot") non
    // è la settimana intera organizzata — va mostrata "parziale", stesso
    // trattamento visivo già usato quando solo alcuni fratelli sono coperti.
    dayBookingOnly?: boolean;
    // BUG CORRETTO 06/08/2026 (segnalato da Fabrizio: "il motore deve sempre
    // funzionare in relazione al timestamp reale") — true se week.endDate è
    // già trascorso rispetto a oggi. Opzionale: chi non lo passa (nessun
    // chiamante pre-esistente lo faceva) ottiene lo stesso comportamento di
    // prima, nessuna settimana viene mai marcata "past".
    isPast?: boolean;
  },
  totalKids: number,
  hasOverlap: boolean,
  isPriority: boolean
): WeekStatus {
  if (week.dismissed) return "dismissed";
  if (week.covered) {
    if (hasOverlap) return "conflict";
    // TRAMA ONE Build Sprint 4 (DEC-42, Task #345): "richiesta" ma non ancora
    // accettata dal centro — distinto da "covered" (confermata) invece di
    // essere mostrata come già a posto, ora che "confirmed" è raggiungibile
    // davvero (prima di questo sprint bookings.status non usciva mai da
    // pending, quindi questa distinzione non era rappresentabile).
    if (week.awaitingPartnerConfirmation) return "awaiting";
    if (week.dayBookingOnly) return "partial";
    if (totalKids > 1 && week.coveredKids.length > 0 && week.coveredKids.length < totalKids) return "partial";
    return "covered";
  }
  // Una settimana coperta resta "covered"/"partial"/"conflict"/"awaiting"
  // anche se ormai passata (è storia, non va nascosta) — solo lo stato di
  // una settimana MAI coperta cambia in base al tempo: passata -> "past"
  // (chiusa), futura -> "priority"/"uncovered" come prima.
  if (week.isPast) return "past";
  return isPriority ? "priority" : "uncovered";
}

export const WEEK_STATUS_BAR_CLASS: Record<WeekStatus, string> = {
  dismissed: "bg-ink-3/25",
  covered: "bg-green",
  partial: "bg-trama-orange",
  conflict: "bg-[#E8543E]",
  priority: "bg-trama-violet",
  uncovered: "bg-[#EEF0F4]",
  awaiting: "bg-sky",
  past: "bg-ink-3/40",
};

// PRE-LAUNCH REMEDIATION WAVE 1 — R-19 (decisione Fabrizio, 24/08/2026,
// promosso a MUST FIX BEFORE MICRO PILOT): la striscia compatta "Stato per
// settimana" in PlannerClient.tsx comunicava gli 8 stati SOLO tramite il
// colore di sfondo (WEEK_STATUS_BAR_CLASS) — un utente ipovedente/daltonico
// o uno screen reader non avevano alcun modo di distinguere "priorità" da
// "sovrapposizione" da "in attesa", ecc. (la riga della Timeline sotto era
// già testuale per ogni ramo — "Non ti serve"/nome attività+dettaglio/
// "Settimana passata"/"Scoperta" — quindi non richiedeva questo fix).
// Label e icona qui sotto sono lette dalla striscia compatta per costruire
// un aria-label completo (screen reader) e un'icona non basata sul colore
// (utente ipovedente/daltonico) — nessun cambio al significato o
// all'ordine di priorità degli stati, solo un canale di comunicazione in
// più oltre al colore (WCAG 1.4.1 "Use of Color").
export const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  dismissed: "Non ti serve",
  covered: "Coperta",
  partial: "Copertura parziale",
  conflict: "Sovrapposizione da controllare",
  priority: "Priorità: da organizzare",
  uncovered: "Da organizzare",
  awaiting: "In attesa di conferma del centro",
  past: "Settimana passata",
};

// Icona Tabler + colore testo scelto per contrasto leggibile sul relativo
// WEEK_STATUS_BAR_CLASS (le barre chiare — "uncovered" — usano un'icona
// scura, le barre scure/sature usano un'icona bianca).
export const WEEK_STATUS_ICON: Record<WeekStatus, { icon: string; colorClass: string }> = {
  dismissed: { icon: "ti-minus", colorClass: "text-ink-3" },
  covered: { icon: "ti-check", colorClass: "text-white" },
  partial: { icon: "ti-circle-half-2", colorClass: "text-white" },
  conflict: { icon: "ti-alert-triangle", colorClass: "text-white" },
  priority: { icon: "ti-star", colorClass: "text-white" },
  uncovered: { icon: "ti-circle-dashed", colorClass: "text-ink-3" },
  awaiting: { icon: "ti-clock-hour-4", colorClass: "text-white" },
  past: { icon: "ti-square-rounded-minus", colorClass: "text-ink-2" },
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
