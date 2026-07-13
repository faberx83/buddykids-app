import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities } from "@/lib/data/activities";
import { getTodayCheckinsForParent } from "@/lib/data/checkin";
import { getCommunityHomeSignal } from "@/lib/data/communities";
import { computeMatchesForKid } from "@/lib/matching";
import HomeDashboardClient from "./HomeDashboardClient";

// SPRINT 1 (NEXTGEN) — Dashboard Genitore: "la mia famiglia è organizzata per
// le prossime settimane?" sostituisce "quali prenotazioni ho?" come domanda
// guida. Nessuna nuova logica dati: orchestra funzioni già esistenti e già
// testate in LEGACY (getPlannerData, getMyBookingsForParent, getKidsForUser,
// getActivities, computeMatchesForKid) — stesso DB, stesso layer, zero
// duplicazione.
export default async function NextgenHomePage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per vedere la Dashboard Genitore NEXTGEN con dati reali.
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [planner, bookings, kids, activities, todayCheckins, communitySignal] = await Promise.all([
    getPlannerData(),
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getTodayCheckinsForParent(),
    getCommunityHomeSignal(),
  ]);

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    fullName = profile?.full_name ?? null;
  }

  // Suggerimenti "per riempire i buchi": solo se ci sono settimane scoperte
  // (altrimenti la famiglia è già organizzata, niente da consigliare — vedi
  // la logica di rassicurazione richiesta). Nessun filtro di disponibilità
  // per-settimana qui (limite noto: lib/matching.ts non ha ancora un concetto
  // di "libera proprio in quella settimana scoperta" — buon candidato per
  // raffinare nello Sprint 2 "Ricerca e scoperta").
  type Recommendation = { activity: (typeof activities)[number]; kidName: string; matchPercent: number };
  const hasGaps = planner.firstUncoveredIndex !== null;

  let recommendations: Recommendation[] = [];
  if (hasGaps) {
    // Miglior punteggio GLOBALE per ogni attività (tra tutti i bambini),
    // ordinato dal più alto — usato per riempire gli eventuali posti
    // rimasti liberi qui sotto.
    const globalBestByActivity = Array.from(
      activities
        .flatMap((a) =>
          kids.map((kid) => ({ activity: a, kidName: kid.name, matchPercent: computeMatchesForKid(kid, [a])[0].matchPercent }))
        )
        .reduce((map, entry) => {
          const existing = map.get(entry.activity.id);
          if (!existing || existing.matchPercent < entry.matchPercent) map.set(entry.activity.id, entry);
          return map;
        }, new Map<string, Recommendation>())
        .values()
    ).sort((a, b) => b.matchPercent - a.matchPercent);

    const usedActivityIds = new Set<string>();

    // SEGNALAZIONE DI FABRIZIO: "i consigliati per voi sono solo per Piero,
    // come mai?" — succedeva perché prima si prendevano semplicemente le 3
    // attività con il punteggio più alto in assoluto: se un bambino ha
    // interessi/età che combaciano meglio con le attività col rating
    // migliore, finisce per occupare da solo tutti e 3 i posti, anche se in
    // famiglia ci sono altri figli. Ora, quando ci sono più bambini, si
    // garantisce PRIMA un consiglio a testa (il suo miglior match), e SOLO
    // dopo si riempiono gli eventuali posti restanti con il punteggio
    // migliore in assoluto — così "Consigliati per voi" rappresenta tutta
    // la famiglia, non solo il bambino più "facile da abbinare".
    if (kids.length > 1) {
      for (const kid of kids) {
        let best: Recommendation | null = null;
        for (const activity of activities) {
          if (usedActivityIds.has(activity.id)) continue;
          const matchPercent = computeMatchesForKid(kid, [activity])[0].matchPercent;
          if (!best || matchPercent > best.matchPercent) best = { activity, kidName: kid.name, matchPercent };
        }
        if (best) {
          recommendations.push(best);
          usedActivityIds.add(best.activity.id);
        }
      }
    }

    for (const entry of globalBestByActivity) {
      if (recommendations.length >= 3) break;
      if (usedActivityIds.has(entry.activity.id)) continue;
      recommendations.push(entry);
      usedActivityIds.add(entry.activity.id);
    }
    recommendations = recommendations.slice(0, 3);
  }

  return (
    <HomeDashboardClient
      firstName={fullName?.split(" ")[0] ?? null}
      planner={planner}
      bookings={bookings}
      recommendations={recommendations}
      todayCheckins={todayCheckins}
      communitySignal={communitySignal}
    />
  );
}
