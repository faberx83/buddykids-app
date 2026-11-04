// TRAMA — "Date e posti": regole dell'inventario di un giorno (test browser
// del 03/11/2026, HIGH). Su "UX DEMO 3 novembre", 8 dicembre: posti totali 2,
// posti liberi 3 → "Salva calendario" lo accettava, dopo il refresh restava
// 2/3 e il grafico mostrava occupazione −25%. Causa verificata:
// saveActivityDaysAction scriveva capacity e spots_left così come arrivavano
// dal browser, senza alcun controllo; l'interfaccia aveva solo min/max HTML
// (aggirabili scrivendo a mano). In più, cambiando i posti totali (giorno
// singolo o modifica multipla) i liberi venivano ricalcolati ignorando i
// posti già confermati.
//
// Regole (le stesse in pagina e sul server, così un dato impossibile non si
// può salvare in nessun modo):
//   - posti totali e liberi: numeri interi da 0 in su;
//   - liberi ≤ totali;
//   - totali ≥ posti già confermati (booking_days con capacity_decremented):
//     ridurre la capienza non cancella prenotazioni, quindi non può scendere
//     sotto chi è già confermato;
//   - liberi ≤ totali − confermati.
// 2/2, 2/0 e 0/0 sono validi (0/0 = nessun posto, per esempio giorno chiuso).

export type InventoryField = "capacity" | "spotsLeft";

export interface DayInventoryIssue {
  date: string;
  field: InventoryField;
  message: string;
}

export interface DayInventoryInput {
  date: string;
  capacity: number;
  spotsLeft: number;
}

const isWholeNonNegative = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;

export function validateDayInventory(day: DayInventoryInput, confirmed = 0): DayInventoryIssue[] {
  const issues: DayInventoryIssue[] = [];
  const conf = Math.max(0, Math.floor(confirmed || 0));
  if (!isWholeNonNegative(day.capacity)) {
    issues.push({ date: day.date, field: "capacity", message: "Posti totali: scrivete un numero intero, da 0 in su." });
  }
  if (!isWholeNonNegative(day.spotsLeft)) {
    issues.push({ date: day.date, field: "spotsLeft", message: "Posti liberi: scrivete un numero intero, da 0 in su." });
  }
  if (issues.length > 0) return issues;

  if (day.capacity < conf) {
    issues.push({
      date: day.date,
      field: "capacity",
      message: `Ci ${conf === 1 ? "è già 1 posto confermato" : `sono già ${conf} posti confermati`}: i posti totali non possono scendere sotto ${conf}.`,
    });
    return issues;
  }
  if (day.spotsLeft > day.capacity) {
    issues.push({ date: day.date, field: "spotsLeft", message: `I posti liberi non possono superare i posti totali (${day.capacity}).` });
  } else if (day.spotsLeft > day.capacity - conf) {
    issues.push({
      date: day.date,
      field: "spotsLeft",
      message: `Con ${conf} ${conf === 1 ? "posto confermato" : "posti confermati"} i liberi possono essere al massimo ${day.capacity - conf}.`,
    });
  }
  return issues;
}

/** Tutti i problemi di un calendario, giorno per giorno (confermati per data). */
export function validateCalendar(days: DayInventoryInput[], confirmedByDate: Record<string, number> = {}): DayInventoryIssue[] {
  return days.flatMap((d) => validateDayInventory(d, confirmedByDate[d.date] ?? 0));
}

/**
 * Posti liberi dopo un cambio dei posti totali: si sposta della stessa
 * differenza (conserva eventuali aggiustamenti fatti a mano) e resta tra 0 e
 * totali − confermati. Prima: nel giorno singolo min(liberi, totali), nella
 * modifica multipla liberi = totali — in entrambi i casi senza contare i
 * posti già confermati.
 */
export function spotsAfterCapacityChange(previous: { capacity: number; spotsLeft: number }, nextCapacity: number, confirmed = 0): number {
  const max = Math.max(0, nextCapacity - Math.max(0, confirmed));
  const shifted = previous.spotsLeft + (nextCapacity - previous.capacity);
  return Math.min(Math.max(shifted, 0), max);
}

/** Messaggio unico per la riga di salvataggio, con le date coinvolte. */
export function inventorySummary(issues: DayInventoryIssue[], formatDate: (iso: string) => string): string {
  const dates = [...new Set(issues.map((i) => i.date))];
  if (dates.length === 0) return "";
  const list = dates.slice(0, 3).map(formatDate).join(", ") + (dates.length > 3 ? ` e altri ${dates.length - 3}` : "");
  return `Da correggere prima di salvare: ${list}. Niente è stato salvato.`;
}

/**
 * Riga accanto a "Salva calendario" mentre ci sono errori (prima di salvare).
 * QA 04/11/2026 (P1a): diceva solo "Da correggere prima di salvare: 8 dic.";
 * ora dice anche che non si salva nulla finché c'è un errore.
 */
export function inventoryBlockingSummary(issues: DayInventoryIssue[], formatDate: (iso: string) => string): string {
  const base = inventorySummary(issues, formatDate);
  if (!base) return "";
  return base.replace(" Niente è stato salvato.", " Finché c'è un errore non si salva niente.");
}
