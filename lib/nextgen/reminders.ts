// SPRINT 5.4 (NEXTGEN) — "Promemoria intelligenti" (PRD Family Planner).
// A differenza delle Missioni (lib/nextgen/missions.ts — messaggi positivi,
// "riducono l'ansia e danno un senso di avanzamento", NON urgenti), i
// Promemoria segnalano cose con una scadenza reale e vicina: qui SI usa un
// tono di urgenza quando serve. Logica pura, nessuna nuova query: riusa
// PlannerData, MyBooking (con i campi daysUntilStart/cancellationWindowDays/
// canCancelOrModify già calcolati per "Le mie prenotazioni"), KidOverlap e
// BudgetSummary — tutti già letti da app/nextgen/planner/page.tsx.

import { PlannerData } from "@/lib/data/planner";
import { MyBooking } from "@/lib/data/my-bookings";
import { Kid } from "@/lib/types";
import { KidOverlap, BudgetSummary, AlertAction, overlapVerb } from "@/lib/nextgen/planner-insights";

export interface Reminder {
  id: string;
  emoji: string;
  text: string;
  tone: "urgent" | "warning" | "info";
  // SPRINT CORRETTIVO (feedback Fabrizio: "le notifiche nascoste... devono
  // avere una CTA?") — dove porta il click sul banner, se ha senso portare
  // da qualche parte (non tutti i promemoria ce l'hanno).
  action?: AlertAction;
}

// 1) Finestra di cancellazione in scadenza — dato reale (non stubbato):
// avvisa quando mancano pochi giorni al termine della finestra di preavviso
// entro cui il genitore può ancora modificare/annullare in autonomia.
function computeCancellationWindowReminders(bookings: MyBooking[]): Reminder[] {
  const reminders: Reminder[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled" || !b.canCancelOrModify || b.daysUntilStart === null) continue;
    const daysLeftInWindow = b.daysUntilStart - b.cancellationWindowDays;
    if (daysLeftInWindow >= 0 && daysLeftInWindow <= 3) {
      reminders.push({
        id: `cancel-window-${b.id}`,
        emoji: "⏳",
        text:
          daysLeftInWindow === 0
            ? `Ultimo giorno per modificare o annullare ${b.activityName} in autonomia.`
            : `Hai ancora ${daysLeftInWindow} giorni per modificare o annullare ${b.activityName} prima che scada la finestra di preavviso.`,
        tone: daysLeftInWindow <= 1 ? "urgent" : "warning",
        action: { type: "link", href: `/prenotazioni/${b.id}/modifica` },
      });
    }
  }
  return reminders;
}

// 2) Attività in arrivo — dato reale: la prima settimana prenotata inizia a
// breve (entro 7 giorni), utile promemoria organizzativo indipendente dalla
// finestra di cancellazione.
function computeUpcomingStartReminders(bookings: MyBooking[]): Reminder[] {
  const reminders: Reminder[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled" || b.daysUntilStart === null) continue;
    if (b.daysUntilStart >= 0 && b.daysUntilStart <= 7) {
      const kidPart = b.kidNames.length > 0 ? ` per ${b.kidNames.join(" e ")}` : "";
      reminders.push({
        id: `upcoming-${b.id}`,
        emoji: "📅",
        text:
          b.daysUntilStart === 0
            ? `${b.activityName}${kidPart} inizia oggi.`
            : `Tra ${b.daysUntilStart} giorni inizia ${b.activityName}${kidPart}.`,
        tone: b.daysUntilStart <= 2 ? "warning" : "info",
        action: { type: "link", href: "/prenotazioni" },
      });
    }
  }
  return reminders;
}

// 3) Settimana prioritaria vicina e ancora scoperta — dato reale: stesso
// algoritmo "settimana prioritaria" già mostrato in Organizzazione, qui con
// l'urgenza legata a quanto manca al suo inizio.
function computePriorityWeekReminder(planner: PlannerData, priorityIndex: number | null, todayIso: string): Reminder | null {
  if (priorityIndex === null) return null;
  const week = planner.weeks.find((w) => w.index === priorityIndex);
  if (!week) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilStart = Math.round(
    (new Date(week.startDate + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) / msPerDay
  );
  if (daysUntilStart < 0 || daysUntilStart > 14) return null;

  return {
    id: `priority-week-${week.index}`,
    emoji: "⚠️",
    text:
      daysUntilStart <= 3
        ? `La Settimana ${week.index} inizia tra ${daysUntilStart} giorni ed è ancora scoperta.`
        : `La Settimana ${week.index} (tra ${daysUntilStart} giorni) è la prossima da organizzare.`,
    tone: daysUntilStart <= 3 ? "urgent" : "info",
    action: { type: "week", index: week.index },
  };
}

// 4) Sovrapposizione da risolvere — dato reale, già rilevato altrove in
// Organizzazione: qui riproposto come promemoria azionabile.
// BUGFIX (segnalato da Fabrizio) — "risulta prenotato" era hardcoded al
// maschile: ora usa overlapVerb(gender) del bambino coinvolto.
// BUGFIX (segnalato da Fabrizio: "non sono azionabili nonostante lo
// sembrino") — l'azione portava a "week" (scroll+evidenzia la riga della
// Timeline): quella riga, per una settimana coperta, è solo un Link alla
// scheda ATTIVITÀ (vedi PlannerClient.tsx), che non permette di annullare
// nessuna delle due prenotazioni in conflitto — un vicolo cieco travestito
// da azione (freccina cliccabile che non risolve nulla). L'unico posto dove
// si può davvero "controllare quale attività tenere" è "Le mie prenotazioni"
// (annulla/modifica una delle due) — l'azione ora porta lì.
function computeOverlapReminders(overlaps: KidOverlap[], kids: Kid[]): Reminder[] {
  return overlaps.slice(0, 2).map((o) => {
    const gender = kids.find((k) => k.id === o.kidId)?.gender;
    return {
      id: `overlap-${o.kidId}-${o.weekId}`,
      emoji: "🔁",
      text: `${o.kidName} risulta ${overlapVerb(gender)} due volte in ${o.weekLabel}: controlla quale attività tenere.`,
      tone: "warning" as const,
      action: { type: "link" as const, href: "/prenotazioni" },
    };
  });
}

// 5) Budget vicino/oltre il target stagionale — dato reale (solo se il
// genitore ha impostato un target in Planner > Budget).
function computeBudgetReminder(budget: BudgetSummary, seasonBudgetTarget: number | null): Reminder | null {
  if (!seasonBudgetTarget || seasonBudgetTarget <= 0) return null;
  const percent = Math.round((budget.totalSpent / seasonBudgetTarget) * 100);
  if (percent >= 100) {
    return {
      id: "budget-over",
      emoji: "💸",
      text: `Hai superato il budget stagionale che avevi impostato (€${budget.totalSpent} di €${seasonBudgetTarget}).`,
      tone: "urgent",
      action: { type: "mode", mode: "budget" },
    };
  }
  if (percent >= 90) {
    return {
      id: "budget-near",
      emoji: "💶",
      text: `Sei al ${percent}% del budget stagionale che avevi impostato.`,
      tone: "warning",
      action: { type: "mode", mode: "budget" },
    };
  }
  return null;
}

// Ordina per urgenza (urgent > warning > info) e limita a 4 — coerente con
// "piccoli obiettivi/messaggi mirati" già scelto per le Missioni, non un
// elenco infinito che genera ansia invece di ridurla.
export function computeReminders(
  planner: PlannerData,
  bookings: MyBooking[],
  priorityIndex: number | null,
  overlaps: KidOverlap[],
  budget: BudgetSummary,
  seasonBudgetTarget: number | null,
  todayIso: string,
  kids: Kid[]
): Reminder[] {
  const all: Reminder[] = [
    ...computeCancellationWindowReminders(bookings),
    ...computeUpcomingStartReminders(bookings),
    ...computeOverlapReminders(overlaps, kids),
  ];
  const priorityReminder = computePriorityWeekReminder(planner, priorityIndex, todayIso);
  if (priorityReminder) all.push(priorityReminder);
  const budgetReminder = computeBudgetReminder(budget, seasonBudgetTarget);
  if (budgetReminder) all.push(budgetReminder);

  const toneWeight: Record<Reminder["tone"], number> = { urgent: 0, warning: 1, info: 2 };
  all.sort((a, b) => toneWeight[a.tone] - toneWeight[b.tone]);
  return all.slice(0, 4);
}
