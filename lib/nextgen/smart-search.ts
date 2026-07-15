// Motore di raccomandazione NEXTGEN — Sprint 2 ("Ricerca e scoperta").
// Riusa la STESSA logica di punteggio di lib/matching.ts
// (matchPercentForKid — età/interessi/rating, nessuna duplicazione),
// aggiungendo due segnali di contesto in più (vicinanza, settimana scoperta
// della famiglia) e un elenco di "reasons" leggibili.
//
// La forma {score, reasons[]} è pensata come punto di innesto per un futuro
// assistente AI (fuori scope in questo sprint, per esplicita richiesta di
// Fabrizio: "preparare l'architettura, niente AI vera ora"): domani
// "reasons" potrà arrivare da un modello invece che da regole fisse, senza
// cambiare la forma dei dati consumata dalla UI — vedi computeSmartMatches.

import { Activity, Kid } from "@/lib/types";
import { matchPercentForKid } from "@/lib/matching";
import { haversineKm } from "@/lib/geo";

export interface SmartMatch {
  activity: Activity;
  // Bambino per cui questo punteggio è più alto (null se nessun bambino in
  // profilo, es. genitore appena registrato).
  kidName: string | null;
  // Non normalizzato in modo rigoroso: serve solo a ordinare i risultati tra
  // loro, non ha un significato assoluto (es. "%").
  score: number;
  reasons: string[];
}

export interface SmartMatchOptions {
  geo?: { lat: number; lng: number } | null;
  // Data ISO di inizio della prima settimana NON coperta dalla famiglia
  // (da PlannerData.weeks, calcolata dalla Dashboard) — dà priorità a chi
  // ha disponibilità proprio lì, collegando Ricerca alla pianificazione.
  uncoveredWeekStart?: string | null;
  // Per settimana (chiave = data ISO inizio), gli activity.dbId con posti
  // liberi — stessa mappa già usata da Cerca/Planner LEGACY
  // (getActivityAvailabilityByWeek).
  availabilityByWeek?: Record<string, string[]>;
}

export function computeSmartMatches(
  activities: Activity[],
  kids: Kid[],
  options: SmartMatchOptions = {}
): SmartMatch[] {
  const { geo, uncoveredWeekStart, availabilityByWeek } = options;
  const availableInGapIds = uncoveredWeekStart ? new Set(availabilityByWeek?.[uncoveredWeekStart] ?? []) : null;

  const results: SmartMatch[] = activities.map((activity) => {
    // Punteggio migliore tra i bambini: una raccomandazione buona anche per
    // un solo figlio non va scartata solo perché non piace agli altri.
    // SPRINT 3 (feedback Fabrizio: "se piace a più bambini, raggruppa in
    // 'Piacciono ai tuoi figli' invece di ripetere 'Piace a X'") — oltre al
    // migliore (usato per lo score, invariato), teniamo traccia di TUTTI i
    // bambini che superano la soglia, per decidere il testo del reason.
    let best: { kidName: string | null; percent: number } = { kidName: null, percent: 0 };
    const matchingKidNames: string[] = [];
    for (const kid of kids) {
      const percent = matchPercentForKid(kid, activity);
      if (percent >= 40) matchingKidNames.push(kid.name);
      if (percent > best.percent) best = { kidName: kid.name, percent };
    }

    let score = best.percent;
    const reasons: string[] = [];
    // SPRINT 3 correttivo (feedback Fabrizio): "scriverei 'Piace ai tuoi
    // figli' perché la label è per singola attività, non per un gruppo" —
    // verbo al singolare (concorda con "questa attività piace"), non
    // "piacciono" (che suonerebbe corretto solo per un elenco di attività).
    if (matchingKidNames.length >= 2) reasons.push("Piace ai tuoi figli");
    else if (matchingKidNames.length === 1) reasons.push(`Piace a ${matchingKidNames[0]}`);

    if (geo && activity.lat !== undefined && activity.lng !== undefined) {
      const km = haversineKm(geo.lat, geo.lng, activity.lat, activity.lng);
      if (km <= 5) {
        score += 15;
        reasons.push("Vicino a te");
      } else if (km <= 15) {
        score += 5;
      }
    }

    if (availableInGapIds && activity.dbId && availableInGapIds.has(activity.dbId)) {
      score += 20;
      reasons.push("Libera nella settimana ancora scoperta");
    }

    if (activity.rating >= 4.5) reasons.push("Ben valutata");

    return { activity, kidName: best.kidName, score, reasons };
  });

  return results.sort((a, b) => b.score - a.score);
}
