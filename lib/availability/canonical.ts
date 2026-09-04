// TRAMA FINAL HARDENING CLOSURE §1-3 (04/09/2026) — disponibilità CANONICA
// condivisa da TUTTE le superfici Parent (Home, Scopri, Preferiti, Planner
// recommendations, ActivityCard ovunque riusata) e allineata alla stessa
// regola già usata da Activity Detail (Fix #128, app/activity/[id]/page.tsx)
// e dal wizard di prenotazione (lib/data/weeks.ts::getWeeksForActivity).
//
// PRIMA di questo file: solo Activity Detail leggeva la disponibilità reale
// (activity_weeks/activity_days); tutte le liste (ActivityCard) leggevano
// ancora `activities.spots_left`/`show_exact_spots`, il campo EDITORIALE
// digitato a mano dal gestore (vedi ActivityEditForm, "Posti rimasti in
// evidenza") — completamente scollegato dalla capacità reale. Root cause
// della divergenza segnalata dal vivo ("Solo 0 posti!" su una card ancora
// prenotabile, o viceversa).
//
// SCELTA DI IMPLEMENTAZIONE — "no 6 query indipendenti": UNA sola funzione
// batched (attachCanonicalAvailability), chiamata UNA volta dentro
// getActivities() (lib/data/activities.ts, la fonte condivisa da Home
// Legacy/NextGen, Cerca/Scopri Legacy/NextGen, Preferiti
// (lib/data/favorites.ts::getFavoriteActivitiesForParent, che riusa
// getActivities()), Planner, Community, Gruppi — 19 punti di chiamata,
// verificato via grep) invece di ripetere la query in ognuna delle
// superfici. Stesso pattern già in uso in questo file per
// attachApprovedCertificationBadges — due query totali (activity_weeks +
// activity_days) per l'INTERA lista, mai una per attività.
//
// REGOLA DI DECISIONE — computeActivityAvailability() è la stessa identica
// combinazione booking_mode + hasAvailableWeek + hasAvailableDay già usata
// in app/activity/[id]/page.tsx (non duplicata: quella pagina resta sulla
// propria query per-attività perché le serve anche l'allineamento alla
// griglia stagionale per l'etichetta "Settimana N" del wizard — ma la
// REGOLA di decisione booleana è la stessa funzione pura, importata da
// entrambi i punti, cosi la stessa combinazione activity+week+day non può
// restituire uno stato diverso su Activity Detail rispetto a una card di
// lista).

import { Activity } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getSeasonWeekRanges, isoDate } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

export interface CanonicalAvailability {
  available: boolean;
  /** Posti minimi reali fra le settimane offerte e disponibili, null se non disponibile o non significativo. */
  spotsLeft: number | null;
}

// Pura, nessun I/O — stessa combinazione già validata manualmente in
// app/activity/[id]/page.tsx (Fix #128): "day_only" guarda solo i giorni,
// "mixed" è disponibile se ALMENO UNO dei due canali ha capacità reale,
// "week_only" (o bookingMode non configurato, comportamento storico) guarda
// solo le settimane.
export function computeActivityAvailability(
  bookingMode: Activity["bookingMode"] | null | undefined,
  hasAvailableWeek: boolean,
  hasAvailableDay: boolean,
  minAvailableWeekSpots: number | null
): CanonicalAvailability {
  const available =
    bookingMode === "day_only"
      ? hasAvailableDay
      : bookingMode === "mixed"
      ? hasAvailableWeek || hasAvailableDay
      : hasAvailableWeek;
  return { available, spotsLeft: available ? minAvailableWeekSpots : null };
}

interface RawWeekAvailRow {
  activity_id: string;
  spots_left: number | null;
  end_date: string;
}

interface RawDayAvailRow {
  activity_id: string;
  spots_left: number | null;
}

/**
 * Arricchisce `activities` con la disponibilità reale, sovrascrivendo i
 * campi editoriali `spotsLeft`/`showExactSpots`. Attività senza `dbId`
 * (dati mock/demo, mai reali) restano invariate — non esiste alcuna riga
 * activity_weeks/activity_days da interrogare per loro.
 */
export async function attachCanonicalAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  activities: Activity[]
): Promise<Activity[]> {
  const dbIds = activities.map((a) => a.dbId).filter((id): id is string => Boolean(id));
  if (dbIds.length === 0) return activities;

  // "Futuro/rilevante" = non ancora concluso — stesso criterio di
  // dropPastWeeks() in lib/data/weeks.ts, qui semplificato a un confronto
  // sulla data ISO completa (questa funzione non ha bisogno della
  // tolleranza multi-anno del seed demo, solo dati reali con dbId).
  const todayIso = new Date().toISOString().slice(0, 10);

  // FIX (TRAMA FINAL HARDENING CLOSURE, segnalazione Fabrizio 04/09/2026) —
  // stesso taglio superiore applicato a getActivityDays
  // (lib/data/activity-days.ts): un giorno activity_days oltre la fine
  // della griglia stagionale canonica (settimana 16) non è mai davvero
  // prenotabile (il wizard/Attività Detail lo escludono comunque), quindi
  // non deve far apparire una card come "disponibile" per un'attività
  // "day_only"/"mixed" — stessa incoerenza già risolta altrove (banner
  // disponibile ma flusso che non lo permette). activity_weeks non
  // necessita dello stesso taglio: è già strutturalmente limitata alle 16
  // settimane canoniche per costruzione (getWeeksForActivity), non
  // interrogata qui a righe grezze illimitate come activity_days.
  const seasonYear = await getSeasonYear();
  const seasonRanges = getSeasonWeekRanges(seasonYear);
  const seasonEndIso = isoDate(seasonRanges[seasonRanges.length - 1].end);

  const [{ data: weekRows, error: weekError }, { data: dayRows, error: dayError }] = await Promise.all([
    supabase
      .from("activity_weeks")
      .select("activity_id, spots_left, end_date")
      .in("activity_id", dbIds)
      .gte("end_date", todayIso),
    supabase
      .from("activity_days")
      .select("activity_id, spots_left")
      .in("activity_id", dbIds)
      .eq("is_open", true)
      .eq("single_day_bookable", true)
      .gte("date", todayIso)
      .lte("date", seasonEndIso),
  ]);

  if (weekError && dayError) return activities; // entrambe le query fallite: nessun dato da applicare, meglio l'editoriale di niente

  const weekSpotsByActivity = new Map<string, number[]>();
  for (const row of (weekRows ?? []) as RawWeekAvailRow[]) {
    const spots = row.spots_left ?? 0;
    if (spots <= 0) continue;
    const arr = weekSpotsByActivity.get(row.activity_id) ?? [];
    arr.push(spots);
    weekSpotsByActivity.set(row.activity_id, arr);
  }

  const daysAvailableByActivity = new Set<string>();
  for (const row of (dayRows ?? []) as RawDayAvailRow[]) {
    if ((row.spots_left ?? 0) > 0) daysAvailableByActivity.add(row.activity_id);
  }

  return activities.map((a) => {
    if (!a.dbId) return a;
    const weekSpots = weekSpotsByActivity.get(a.dbId) ?? [];
    const hasAvailableWeek = weekSpots.length > 0;
    const hasAvailableDay = daysAvailableByActivity.has(a.dbId);
    const canonical = computeActivityAvailability(
      a.bookingMode,
      hasAvailableWeek,
      hasAvailableDay,
      hasAvailableWeek ? Math.min(...weekSpots) : null
    );
    return {
      ...a,
      spotsLeft: canonical.available ? canonical.spotsLeft ?? undefined : 0,
      // showExactSpots resta la preferenza del gestore ("mostra il numero
      // esatto" vs "mostra solo un badge generico") — solo il VALORE
      // sottostante cambia da editoriale a reale, la scelta di mostrarlo o
      // no resta sua.
    };
  });
}
