// Griglia delle 13 settimane della stagione estiva (metà giugno - metà
// settembre), lun-ven, uguale per tutta la piattaforma — è la "fonte di
// verità" della numerazione settimane usata sia dal Planner in Home sia dal
// selettore settimane in Prenotazione, così "Settimana 6" indica sempre lo
// stesso intervallo di date ovunque nell'app (prima non era garantito: il
// Planner aveva le sue 13 settimane, la Prenotazione mostrava solo le
// settimane configurate per quella specifica attività, con numerazione
// indipendente — confuso per chi arriva dal Planner con una settimana precisa
// in mente).

export const SEASON_TOTAL_WEEKS = 13;

export interface SeasonWeekRange {
  index: number; // 1-based
  start: Date;
  end: Date;
}

// Genera le 13 settimane (lun-ven) della stagione estiva dell'anno indicato,
// a partire dal primo lunedì di giugno.
export function getSeasonWeekRanges(year: number): SeasonWeekRange[] {
  const june1 = new Date(Date.UTC(year, 5, 1));
  const dayOfWeek = june1.getUTCDay(); // 0=domenica
  const daysToMonday = (8 - dayOfWeek) % 7;
  const firstMonday = new Date(june1);
  firstMonday.setUTCDate(june1.getUTCDate() + daysToMonday);

  const ranges: SeasonWeekRange[] = [];
  for (let i = 0; i < SEASON_TOTAL_WEEKS; i++) {
    const start = new Date(firstMonday);
    start.setUTCDate(firstMonday.getUTCDate() + i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4); // venerdì
    ranges.push({ index: i + 1, start, end });
  }
  return ranges;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTH_LABELS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

// Formato unico dell'intervallo di date di una settimana, usato ORA in ogni
// sezione dell'app (Planner, selettore Prenotazione, banner Cerca, riepilogo
// Prenotazione) — prima ogni sezione aveva un formato diverso ("2–6/6" con
// mese numerico in un posto, "24 giu – 28 giu" testuale in un altro),
// disallineati tra loro. Le settimane della griglia stagionale sono sempre
// lun-ven dello stesso mese, quindi un'unica etichetta mese basta: "GIU 2-6".
export function formatShortRange(start: Date, end: Date): string {
  const month = MONTH_LABELS_IT[start.getUTCMonth()].toUpperCase();
  return `${month} ${start.getUTCDate()}-${end.getUTCDate()}`;
}

// "24 giu – 28 giu" — mantenuta per compatibilità/casi con mesi diversi, ma
// non più usata nelle sezioni principali (vedi formatShortRange sopra).
export function formatLongRange(start: Date, end: Date): string {
  const s = `${start.getUTCDate()} ${MONTH_LABELS_IT[start.getUTCMonth()]}`;
  const e = `${end.getUTCDate()} ${MONTH_LABELS_IT[end.getUTCMonth()]}`;
  return `${s} – ${e}`;
}

// "Sett. N" — versione compatta di "Settimana N", usata come etichetta
// secondaria nelle card (WeekCard) dove il range di date è ora l'elemento
// principale.
export function shortWeekLabel(label: string): string {
  return label.replace(/^Settimana/, "Sett.");
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// L'anno "di stagione" da usare per generare la griglia delle 13 settimane
// NON deve essere sempre l'anno solare corrente: i dati reali (activity_weeks,
// prenotazioni) sono ancorati all'anno in cui sono stati creati/seminati, che
// puo' differire dall'anno corrente se l'ambiente demo non viene rigenerato
// ogni stagione. Se la griglia usasse sempre "oggi.anno" mentre i dati reali
// sono di un anno diverso, NESSUNA data si sovrapporrebbe mai — tutte le
// settimane risulterebbero "non disponibili" anche quando l'attività ha
// davvero posti liberi (bug osservato: scheda attività diceva "5 di 8
// settimane disponibili" ma il selettore prenotazione le mostrava tutte
// come non attive). Qui deduciamo l'anno dall'anno più frequente tra le date
// reali fornite, con l'anno corrente solo come fallback quando non c'e'
// ancora nessuna data reale da cui dedurlo (es. attività senza settimane
// configurate, o utente senza prenotazioni).
export function seasonYearFromDates(dates: (string | null | undefined)[], fallback: number): number {
  const counts = new Map<number, number>();
  for (const d of dates) {
    if (!d) continue;
    const y = Number(d.slice(0, 4));
    if (!Number.isNaN(y)) counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [y, c] of counts) {
    if (c > bestCount) {
      best = y;
      bestCount = c;
    }
  }
  return best;
}
