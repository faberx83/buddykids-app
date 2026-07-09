// Anno "di stagione" usato per generare la griglia delle 13 settimane in
// TUTTA l'app (Planner in Home, selettore settimane in Prenotazione). Deve
// essere lo STESSO ovunque, altrimenti "Settimana 5" nel Planner e
// "Settimana 5" nel flusso di prenotazione di una specifica attività
// puntano a intervalli di calendario diversi e smettono di corrispondersi.
//
// Bug osservato che ha portato a questo file: un genitore ha usato "Riempi"
// dal Planner per la Settimana 5, prenotato con successo, ma tornando in
// Home quella settimana non risultava coperta — perché il Planner derivava
// l'anno della griglia dalle prenotazioni GIÀ ESISTENTI del genitore (per un
// utente alla prima prenotazione, nessuna: fallback all'anno corrente),
// mentre il selettore prenotazione derivava l'anno dalle date REALI della
// singola attività (i dati demo sono del 2025). Le due griglie usavano anni
// diversi, quindi la data richiesta da "Riempi" non trovava corrispondenza
// nel selettore: veniva prenotata la prima settimana disponibile qualsiasi,
// non quella scelta — e in casi limite (nessuna settimana marcata
// "offered") la prenotazione partiva senza nemmeno una settimana selezionata.
//
// Soluzione: un'unica fonte per l'anno, dedotta dalle date reali di TUTTE le
// settimane configurate dai centri (activity_weeks) in tutto il sistema —
// non dalla cronologia di un singolo genitore né dall'orologio di sistema —
// con fallback all'anno corrente solo se il sistema non ha ancora nessuna
// settimana configurata (installazione nuova, prima di qualunque seed).
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { seasonYearFromDates } from "@/lib/season-weeks";

let cachedYear: number | null = null;

export async function getSeasonYear(): Promise<number> {
  const currentYear = new Date().getUTCFullYear();
  if (!isSupabaseConfigured) return currentYear;
  if (cachedYear !== null) return cachedYear;

  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_weeks").select("start_date").limit(500);

  if (error || !data || data.length === 0) {
    return currentYear;
  }

  const year = seasonYearFromDates(
    (data as { start_date: string }[]).map((r) => r.start_date),
    currentYear
  );
  cachedYear = year;
  return year;
}
