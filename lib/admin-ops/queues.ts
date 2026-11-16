// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Fai del
// Command Center la home Admin e chiamala 'Oggi'. Ogni contatore apre la coda
// già filtrata e il conteggio deve corrispondere alle righe risultanti, a
// parità di filtri. Per ogni coda mostra chi deve agire, anzianità,
// eventuale scadenza e prossimo passo. Dai evidenza alle attività imminenti
// rimaste senza risposta." Iniziativa: claude/INIZIATIVA_admin_operativo.md.
//
// Logica PURA delle code di "Oggi". Ogni coda riceve GIÀ le righe filtrate
// con la stessa regola della pagina di destinazione (vedi lib/data/
// command-center.ts): qui si calcolano solo conteggio, anzianità, scadenza,
// priorità e anteprima. Il conteggio è sempre items.length, mai un numero
// calcolato a parte.

import { computeQueuePriority, compareQueuesByPriority, type QueuePriority } from "@/lib/command-center/priority";
import { ACTOR_LABEL, daysBetween, type Actor } from "@/lib/admin-ops/bookings";

export interface QueueItem {
  id: string;
  title: string;
  /** Riga breve sotto il titolo (centro, attività, data). */
  sub?: string | null;
  createdAt: string | null;
  /** Prossima data utile (es. primo giorno richiesto), yyyy-mm-dd. */
  dueDate?: string | null;
  href: string;
}

export interface QueueInput {
  key: string;
  label: string;
  actor: Actor;
  href: string;
  nextStep: string;
  items: QueueItem[];
  /** Forza la priorità alta appena c'è un elemento (es. allarmi dei flag). */
  alwaysHigh?: boolean;
  /** Elementi nascosti perché di prova (mostrati come nota). */
  hiddenDemo?: number;
  /** Link alla stessa coda con le prove visibili (?demo=1). Retest 12/11/2026. */
  demoHref?: string;
  /** Nota breve sotto la coda (es. richieste uscite perché già registrate). Lotto 2, 16/11/2026. */
  note?: string;
}

export interface OggiQueue {
  key: string;
  label: string;
  actor: Actor;
  actorLabel: string;
  count: number;
  priority: QueuePriority;
  /** Giorni dell'elemento più vecchio; null se la coda è vuota o senza date. */
  oldestDays: number | null;
  /** Data più vicina tra gli elementi (yyyy-mm-dd), null se nessuna. */
  nearestDue: string | null;
  nearestDueInDays: number | null;
  nextStep: string;
  href: string;
  preview: QueueItem[];
  hiddenDemo: number;
  demoHref: string | null;
  note: string | null;
  /** Riga breve per la card: "più vecchia: 5 giorni fa · prima data: tra 3 giorni". */
  detail: string | null;
}

export function ageLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 0) return "oggi";
  return days === 1 ? "1 giorno fa" : `${days} giorni fa`;
}

export function dueLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return "data passata";
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  return `tra ${days} giorni`;
}

export function buildQueue(input: QueueInput, todayIso: string, previewSize = 3): OggiQueue {
  const ages = input.items.filter((i) => i.createdAt).map((i) => Math.max(0, daysBetween(i.createdAt as string, todayIso)));
  const oldestDays = ages.length > 0 ? Math.max(...ages) : null;
  const dues = input.items.map((i) => i.dueDate).filter((d): d is string => Boolean(d) && (d as string) >= todayIso).sort();
  const nearestDue = dues[0] ?? null;
  const nearestDueInDays = nearestDue ? daysBetween(todayIso, nearestDue) : null;
  const count = input.items.length;
  let priority: QueuePriority = input.alwaysHigh ? (count > 0 ? "alta" : "bassa") : computeQueuePriority(count, oldestDays);
  // Una data a 3 giorni o meno senza risposta è sempre alta priorità.
  if (count > 0 && nearestDueInDays !== null && nearestDueInDays <= 3) priority = "alta";
  const parts = [
    oldestDays !== null ? `più vecchia: ${ageLabel(oldestDays)}` : null,
    nearestDue ? `prima data: ${dueLabel(nearestDueInDays)}` : null,
  ].filter(Boolean);
  const preview = [...input.items]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .slice(0, previewSize);
  return {
    key: input.key,
    label: input.label,
    actor: input.actor,
    actorLabel: ACTOR_LABEL[input.actor],
    count,
    priority,
    oldestDays,
    nearestDue,
    nearestDueInDays,
    nextStep: input.nextStep,
    href: input.href,
    preview,
    hiddenDemo: input.hiddenDemo ?? 0,
    demoHref: input.demoHref ?? null,
    note: input.note ?? null,
    detail: parts.length > 0 ? parts.join(" · ") : null,
  };
}

export function buildOggiQueues(inputs: QueueInput[], todayIso: string): OggiQueue[] {
  return inputs.map((i) => buildQueue(i, todayIso)).sort(compareQueuesByPriority);
}
