// TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026).
//
// Funzione pura (nessun I/O, nessuna dipendenza da Supabase/Next — stesso
// principio "core puro" di need-core.ts) per il MATCHING fra
// kid_school_profiles.comune e school_calendar_events.comune. Necessaria
// perché un confronto testuale diretto ("Milano" === "milano") è troppo
// fragile: un genitore o un Admin possono scrivere il comune con maiuscole o
// spazi diversi senza che sia un errore.
//
// Questa normalizzazione serve SOLO per calcolare la CHIAVE di matching
// applicativo (la mappa localEventsByRegionComune in lib/data/school-calendar.ts)
// — non tocca MAI il valore salvato/mostrato in DB: kid_school_profiles.comune
// e school_calendar_events.comune restano esattamente come scritti
// dall'utente ("Milano", non "milano"). Nessun ISTAT, nessuna nuova tabella
// Comuni, nessun geocoding — fuori scope per istruzione esplicita.

/**
 * Normalizza un valore "comune" in una chiave di confronto stabile:
 * trim + collasso spazi multipli in uno solo + lowercase. Ritorna `null`
 * per un valore assente/vuoto — un profilo o un evento senza comune
 * (baseline regionale, o bambino senza comune impostato) devono avere la
 * STESSA chiave "nessun comune", mai la stringa vuota (che sarebbe una
 * chiave "valida" per errore).
 *
 * Esempi che DEVONO produrre la stessa chiave:
 *   "Milano" / "MILANO" / " milano " / "  Milano  " -> "milano"
 *   "Milano  Ovest" / "Milano   Ovest" -> "milano ovest" (spazi interni
 *   multipli collassati, mai solo i bordi)
 */
export function normalizeComuneKey(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) return null;
  return collapsed.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────
// TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026). Logica pura di
// composizione region+comune — estratta da lib/data/school-calendar.ts
// (stesso principio "core puro + wrapper I/O sottile" già seguito da
// need-core.ts) cosi' da essere testabile senza mock Supabase. Il wrapper
// I/O costruisce i RegionComuneEvent (region risolta da school_calendars,
// comune letto direttamente dalla riga school_calendar_events) e poi
// chiama SOLO queste due funzioni — nessuna logica di raggruppamento
// duplicata nel file I/O.
// ─────────────────────────────────────────────────────────────────────────

import type { SchoolCalendarEventInput } from "./need-core";

export interface RegionComuneEvent {
  region: string;
  // NULL = evento regionale, valorizzato = evento locale (testo originale,
  // MAI normalizzato qui — la normalizzazione avviene solo nella chiave).
  comune: string | null;
  event: SchoolCalendarEventInput;
}

export interface GroupedSchoolCalendarEvents {
  regionalEventsByRegion: Map<string, SchoolCalendarEventInput[]>;
  // Chiave "region|<chiave normalizzata>" — un comune esiste sempre insieme
  // a una regione (mai da solo), la combinazione evita collisioni fra
  // comuni omonimi di regioni diverse.
  localEventsByRegionComune: Map<string, SchoolCalendarEventInput[]>;
}

/**
 * Raggruppa un set di eventi grezzi (già annotati con region+comune) nelle
 * due mappe regionale/locale. Un evento con comune=null (o blank/whitespace,
 * via normalizeComuneKey) finisce SEMPRE nella baseline regionale — mai una
 * terza categoria "comune invalido".
 */
export function groupEventsByScope(rows: RegionComuneEvent[]): GroupedSchoolCalendarEvents {
  const regionalEventsByRegion = new Map<string, SchoolCalendarEventInput[]>();
  const localEventsByRegionComune = new Map<string, SchoolCalendarEventInput[]>();
  for (const row of rows) {
    const comuneKey = normalizeComuneKey(row.comune);
    if (comuneKey === null) {
      const list = regionalEventsByRegion.get(row.region) ?? [];
      list.push(row.event);
      regionalEventsByRegion.set(row.region, list);
    } else {
      const key = `${row.region}|${comuneKey}`;
      const list = localEventsByRegionComune.get(key) ?? [];
      list.push(row.event);
      localEventsByRegionComune.set(key, list);
    }
  }
  return { regionalEventsByRegion, localEventsByRegionComune };
}

/**
 * Eventi risolti per UN bambino: baseline regionale della sua region +
 * eventi locali del suo comune (se impostato). `profile.comune === null`
 * (o blank) -> nessuna chiave può matchare -> SOLO baseline regionale,
 * comportamento sicuro e prevedibile (nessun evento locale "indovinato").
 * Unione semplice: nessun dedup qui, buildClosureIntervals/closedWeekdayCount
 * (need-core.ts) già trattano l'insieme come un OR di intervalli, non una
 * somma — un evento regionale e uno locale sullo stesso giorno non
 * raddoppiano mai closedWeekdaysCount.
 */
export function composeKidCalendarEvents(
  grouped: GroupedSchoolCalendarEvents,
  profile: { region: string; comune: string | null }
): SchoolCalendarEventInput[] {
  const regionalEvents = grouped.regionalEventsByRegion.get(profile.region) ?? [];
  const comuneKey = normalizeComuneKey(profile.comune);
  const localEvents = comuneKey !== null ? (grouped.localEventsByRegionComune.get(`${profile.region}|${comuneKey}`) ?? []) : [];
  return [...regionalEvents, ...localEvents];
}
