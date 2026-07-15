// Settimane prenotabili di un'attività — da Supabase (activity_weeks) se
// collegato e disponibili, altrimenti dai dati mock. In entrambi i casi il
// risultato è sempre allineato alla griglia stagionale condivisa di 13
// settimane (lib/season-weeks.ts, la stessa usata dal Planner in Home): un
// campo estivo di solito copre solo una parte dell'estate, ma le settimane
// che NON copre restano comunque nell'elenco con offered=false invece di
// sparire, così "Settimana 6" indica sempre lo stesso intervallo di
// calendario sia nel Planner sia qui, e chi arriva da "Riempi" per una
// settimana precisa la ritrova nello stesso punto della griglia.

import { Activity, Week } from "@/lib/types";
import { weeksByActivity, defaultWeeks } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, isoDate, formatShortRange, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

interface RawWeekRow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  spots_left: number | null;
}

function placeholderWeek(index: number, startDate: string, endDate: string, start: Date, end: Date): Week {
  return {
    id: `season-${index}`,
    label: `Settimana ${index}`,
    dates: formatShortRange(start, end),
    spots: 0,
    soldOut: true,
    seasonIndex: index,
    startDate,
    endDate,
    offered: false,
  };
}

// Dati mock: non hanno date reali, solo un'etichetta "Settimana N" — la
// usiamo per capire a quale settimana della stagione corrisponde ciascuna,
// e riempiamo con placeholder "non offerta" le settimane 1-13 mancanti
// (es. defaultWeeks ne ha solo 4) invece di mostrarne solo 4 su 13.
function seasonAlignedFromMock(mockWeeks: Week[], year: number): Week[] {
  const ranges = getSeasonWeekRanges(year);
  const byIndex = new Map<number, Week>();
  mockWeeks.forEach((w, i) => {
    const m = w.label.match(/(\d+)/);
    const idx = m ? Number(m[1]) : i + 1;
    byIndex.set(idx, w);
  });

  return ranges.map((r) => {
    const startDate = isoDate(r.start);
    const endDate = isoDate(r.end);
    const match = byIndex.get(r.index);
    if (!match) return placeholderWeek(r.index, startDate, endDate, r.start, r.end);
    return {
      ...match,
      label: `Settimana ${r.index}`,
      dates: formatShortRange(r.start, r.end),
      seasonIndex: r.index,
      startDate,
      endDate,
      offered: true,
    };
  });
}

function seasonAlignedFromReal(rows: RawWeekRow[], year: number): Week[] {
  const ranges = getSeasonWeekRanges(year);
  return ranges.map((r) => {
    const startDate = isoDate(r.start);
    const endDate = isoDate(r.end);
    const match = rows.find((row) => overlaps(startDate, endDate, row.start_date, row.end_date));
    if (!match) return placeholderWeek(r.index, startDate, endDate, r.start, r.end);
    const spots = match.spots_left ?? 0;
    return {
      id: match.id,
      label: `Settimana ${r.index}`,
      dates: formatShortRange(r.start, r.end),
      spots,
      soldOut: spots <= 0,
      seasonIndex: r.index,
      startDate,
      endDate,
      offered: true,
    };
  });
}

// Segnalazione di Fabrizio: "le settimane già passate rispetto a OGGI (data
// di sistema) non devono essere selezionabili né visibili" — nel selettore
// di Prenotazione/Modifica prenotazione una settimana già conclusa non ha
// più senso ne' da prenotare ne' da mostrare.
//
// ATTENZIONE ANTI-REGRESSIONE — confronto SOLO su mese-giorno, MAI sull'anno
// intero: il dataset demo principale (supabase/seed.sql) ha le
// activity_weeks scritte con date fisse "2025-06-24".."2025-08-02", congelate
// all'anno in cui il file è stato scritto — non rigenerate ad ogni deploy
// (a differenza delle poche righe di supabase/seed-test-data.sql, quelle sì
// relative a current_date). Un confronto sulla data ISO COMPLETA (come
// todayIso >= week.start_date, lo stesso pattern di "isCurrentWeek" in
// lib/data/attendance.ts) avrebbe funzionato solo finché l'anno reale
// coincide con l'anno congelato nel seed: non appena l'orologio di sistema
// supera quell'anno (esattamente la situazione attuale), TUTTE le settimane
// di quelle 5 attività demo sarebbero risultate "passate" e sparite dal
// selettore — prenotazione impossibile per l'intero dataset dimostrativo,
// una regressione ben peggiore del problema da risolvere. La stagione dei
// centri estivi ricade sempre in giu-ago di un anno qualsiasi: confrontando
// solo "MM-DD" (confronto stringa valido perché mese/giorno sono sempre a 2
// cifre) il filtro funziona indipendentemente da quale anno è scritto nei
// dati, seed compreso.
function dropPastWeeks(weeks: Week[]): Week[] {
  const todayMonthDay = new Date().toISOString().slice(5, 10);
  // endDate è opzionale nel tipo Week (usato anche altrove per settimane
  // senza allineamento stagionale) — qui sia da mock sia da dati reali è
  // SEMPRE valorizzato da seasonAlignedFromMock/seasonAlignedFromReal
  // /placeholderWeek, quindi in pratica non è mai undefined; teniamo la
  // settimana per sicurezza se mai lo fosse, invece di nasconderla a torto.
  return weeks.filter((w) => !w.endDate || w.endDate.slice(5, 10) >= todayMonthDay);
}

export async function getWeeksForActivity(activity: Activity): Promise<Week[]> {
  // L'anno della griglia è quello "di stagione" condiviso da tutta l'app
  // (vedi lib/data/season-year.ts) — non quello dell'orologio di sistema né
  // quello dedotto solo dai dati di QUESTA attività, cosi la numerazione
  // "Settimana N" coincide sempre con quella usata dal Planner in Home.
  const seasonYear = await getSeasonYear();

  if (!isSupabaseConfigured || !activity.dbId) {
    return dropPastWeeks(seasonAlignedFromMock(weeksByActivity[activity.id] ?? defaultWeeks, seasonYear));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_weeks")
    .select("id, label, start_date, end_date, spots_left")
    .eq("activity_id", activity.dbId)
    .order("start_date", { ascending: true });

  if (error || !data || data.length === 0) {
    return dropPastWeeks(seasonAlignedFromMock(weeksByActivity[activity.id] ?? defaultWeeks, seasonYear));
  }

  return dropPastWeeks(seasonAlignedFromReal(data as RawWeekRow[], seasonYear));
}

// Settimane di QUESTA attività già coperte da una prenotazione confermata
// del genitore loggato (qualsiasi bambino) — usate dal selettore di
// Prenotazione per bloccare quelle settimane invece di lasciarle
// riselezionabili (rischio di doppia prenotazione dello stesso slot).
// "Confermata" qui vuol dire semplicemente non cancellata: oggi ogni
// prenotazione creata ha già status "confirmed" (non c'e' ancora un vero
// step di pagamento/conferma separato, vedi task pagamenti reali).
// "onlyForKidId": se indicato, considera "già prenotata" una settimana SOLO
// se è QUEL bambino ad essere già iscritto — non basta che la famiglia
// abbia una qualunque prenotazione su quella settimana. Serve al flusso
// "Aggiungi [bambino]" del Planner (copertura parziale: un fratello ha già
// il camp quella settimana, l'altro no): senza questo parametro, la
// settimana risultava sempre bloccata come "già prenotata" anche per il
// bambino che invece andava aggiunto, perché booking_kids/booking_weeks non
// sono incrociati per bambino di default (booking_kids si applica a TUTTE
// le settimane della stessa prenotazione).
export async function getBookedWeekIdsForActivity(
  activityDbId: string,
  onlyForKidId?: string
): Promise<Set<string>> {
  const empty = new Set<string>();
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_weeks ( week_id ), booking_kids ( kid_id )")
    .eq("activity_id", activityDbId)
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return empty;

  const ids = new Set<string>();
  for (const row of data as {
    booking_weeks: { week_id: string }[] | null;
    booking_kids: { kid_id: string }[] | null;
  }[]) {
    if (onlyForKidId) {
      const kidIds = (row.booking_kids ?? []).map((bk) => bk.kid_id);
      if (!kidIds.includes(onlyForKidId)) continue; // questa prenotazione non riguarda il bambino richiesto
    }
    for (const bw of row.booking_weeks ?? []) {
      ids.add(bw.week_id);
    }
  }
  return ids;
}
