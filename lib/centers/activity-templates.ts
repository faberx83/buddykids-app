// TRAMA — PORTALE CENTRI V2, ATTIVITÀ DA MODELLO (28/10/2026, tavole 6 e 7).
// Per un centro, i primi momenti in cui le famiglie lo cercano sono i giorni
// di scuola chiusa: ponte di dicembre, vacanze di Natale, e i pomeriggi.
// Un modello precompila nome, orari, modalità a giorni singoli e i GIORNI
// APERTI della stagione in corso; il centro sceglie solo età, prezzo e posti.
// Logica pura (nessun I/O), testata in tests/one/partner-activities-v2.spec.ts.
// L'estate (a settimane) verrà quando si apre la stagione estiva.

export type TemplateKey = "ponte" | "natale" | "pomeriggi";

export interface ActivityTemplate {
  key: TemplateKey;
  title: string;
  /** Una riga sotto il titolo nella scelta del modello. */
  pitch: string;
  emoji: string;
  name: string;
  hours: string;
  description: string;
}

export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    key: "ponte",
    title: "Ponte di dicembre",
    pitch: "Sant'Ambrogio e Immacolata, giornata intera",
    emoji: "🎄",
    name: "Ponte di Sant'Ambrogio e dell'Immacolata",
    hours: "08:30 - 16:30",
    description:
      "Due giornate intere per i bambini mentre la scuola è chiusa: attività, gioco e pranzo insieme. Si iscrive anche un giorno solo.",
  },
  {
    key: "natale",
    title: "Vacanze di Natale",
    pitch: "I giorni feriali tra Natale e l'Epifania",
    emoji: "⛄",
    name: "Vacanze di Natale",
    hours: "08:30 - 16:30",
    description:
      "Le giornate delle vacanze di Natale con laboratori, gioco e uscite. Si sceglie giorno per giorno, anche solo quelli in cui serve.",
  },
  {
    key: "pomeriggi",
    title: "Pomeriggi dopo la scuola",
    pitch: "Dal lunedì al venerdì, per le prossime 6 settimane",
    emoji: "🎒",
    name: "Pomeriggi dopo la scuola",
    hours: "16:30 - 18:30",
    description:
      "Compiti, gioco e laboratori dopo la scuola. Si iscrive per i giorni che servono, anche uno solo alla settimana.",
  },
];

export function getTemplate(key: string | null | undefined): ActivityTemplate | null {
  return ACTIVITY_TEMPLATES.find((t) => t.key === key) ?? null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const isWeekday = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

/** Festività in cui un centro di solito è chiuso (25, 26 dicembre, 1 e 6 gennaio). */
function isChristmasHoliday(d: Date): boolean {
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return (m === 11 && (day === 25 || day === 26)) || (m === 0 && (day === 1 || day === 6));
}

/**
 * I giorni aperti del modello, dalla data di oggi (fuso di Roma già applicato
 * da chi chiama: `today` è "YYYY-MM-DD"). Sempre date future o di oggi.
 */
export function templateDates(key: TemplateKey, today: string): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const now = utc(y, m - 1, d);
  // La stagione di Natale di quest'anno, o del prossimo se è già passata.
  const season = now > utc(y, 0, 6) && now <= utc(y, 11, 31) ? y : now <= utc(y, 0, 6) ? y - 1 : y;

  if (key === "ponte") {
    // Se il ponte di quest'anno è passato, quello dell'anno dopo.
    const year = now > utc(y, 11, 8) ? y + 1 : y;
    return [iso(utc(year, 11, 7)), iso(utc(year, 11, 8))].filter((x) => x >= today);
  }

  if (key === "natale") {
    const out: string[] = [];
    for (let t = utc(season, 11, 22); t <= utc(season + 1, 0, 6); t = utc(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1)) {
      if (isWeekday(t) && !isChristmasHoliday(t) && iso(t) >= today) out.push(iso(t));
    }
    return out;
  }

  // pomeriggi: 6 settimane feriali dal prossimo lunedì.
  const out: string[] = [];
  const dow = now.getUTCDay();
  const toMonday = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  const start = utc(y, m - 1, d + toMonday);
  for (let i = 0; i < 6 * 7; i++) {
    const t = utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i);
    if (isWeekday(t)) out.push(iso(t));
  }
  return out;
}

/** "7 e 8 dicembre", "22 dicembre – 5 gennaio", ecc.: la riga "giorni" della scheda. */
export function describeDates(dates: string[]): string {
  if (dates.length === 0) return "";
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${s}T00:00:00Z`));
  if (dates.length === 1) return fmt(dates[0]);
  if (dates.length === 2) {
    const [a, b] = dates;
    return a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8))} e ${fmt(b)}` : `${fmt(a)} e ${fmt(b)}`;
  }
  return `dal ${fmt(dates[0])} al ${fmt(dates[dates.length - 1])}, giorni feriali`;
}

/** Il prezzo a settimana che il resto di TRAMA si aspetta, da un prezzo al giorno (lib/day-pricing.ts usa /5). */
export function weeklyFromDaily(pricePerDay: number): number {
  return Number.isFinite(pricePerDay) && pricePerDay > 0 ? Math.round(pricePerDay * 5 * 100) / 100 : 0;
}

/** "Copia di X" per la duplica, senza accumulare "copia di copia di". */
export function duplicateName(name: string): string {
  const base = name.replace(/\s*\(copia(?: \d+)?\)\s*$/i, "").trim();
  return `${base} (copia)`;
}
