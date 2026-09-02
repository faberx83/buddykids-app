import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, isMockActivitiesArray } from "@/lib/data/activities";
import { getTodayCheckinsForParent } from "@/lib/data/checkin";
import { getTodayResponsibilities, getResponsibilitiesForParent, getKidsBookedDaysForWeek } from "@/lib/data/responsibilities";
import { getCoordinationSignal } from "@/lib/data/coordination-signal";
import { isParentProfileIncomplete, getParentProfile } from "@/lib/data/profile";
import { computeMatchesForKid } from "@/lib/matching";
import { WEEKDAYS } from "@/lib/nextgen/responsibility-options";
import HomeDashboardClient from "./HomeDashboardClient";

// TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: stessa tecnica di addDaysIso
// duplicata altrove nel repo (piccola funzione pura, vedi lib/nextgen/
// week-roles.ts e app/nextgen/planner/settimana/[startDate]/page.tsx) —
// converte l'offset in giorni di WEEKDAYS in una data ISO reale.
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: getPlannerData() va
  // risolta PRIMA del resto (invece che nello stesso Promise.all) perché il
  // fetch dei booked-days per il coordinamento (sotto) ha bisogno delle
  // date reali di planner.weeks — non una nuova interpretazione delle
  // settimane, solo una dipendenza in più tra due fetch già esistenti.
  const planner = await getPlannerData();

  // Union delle date lun-ven di TUTTE le settimane non "dismissed" (non solo
  // future: il filtro "futuro/rilevante" — stessa convenzione di
  // computeHeroWeeksSummary, !dismissed && endDate>=todayIso — viene
  // applicato lato client in HomeDashboardClient con l'orologio del client,
  // non qui: così non c'è rischio di disallineamento tra il todayIso del
  // server e quello del client per una manciata di secondi/minuti). Una
  // sola query invece di una per settimana (getKidsBookedDaysForWeek accetta
  // già un array arbitrario di date, vedi lib/data/responsibilities.ts).
  const weekdayDatesUnion = Array.from(
    new Set(
      planner.weeks
        .filter((w) => !w.dismissed)
        .flatMap((w) => WEEKDAYS.map((wd) => addDaysIso(w.startDate, wd.dayOffset)))
    )
  );

  const [
    bookings,
    kids,
    activities,
    todayCheckins,
    todayResponsibilities,
    coordinationSignal,
    profileIncomplete,
    profile,
    responsibilities,
    coordinationBookedDays,
  ] = await Promise.all([
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getTodayCheckinsForParent(),
    // FEATURE (01/09/2026, richiesta di Fabrizio): reminder "chi fa cosa"
    // per oggi — vedi lib/data/responsibilities.ts#getTodayResponsibilities.
    getTodayResponsibilities(),
    getCoordinationSignal(),
    // Gap segnalato da Fabrizio (05/08): NEXTGEN non aveva mai un equivalente
    // del prompt "Completa il tuo profilo" del Legacy — stessa fonte dati,
    // vedi NextgenProfileCompletionPrompt più sotto.
    isParentProfileIncomplete(),
    // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 8): stessa
    // getParentProfile() già usata dal Planner (app/nextgen/planner/page.tsx)
    // per risolvere "Mamma"/"Papà" contestuali — qui serve solo
    // profile.parentRole, passato a TodayResponsibilityReminder cosi il
    // reminder giornaliero usi lo stesso mapping del selettore Planner
    // invece di mostrare sempre "Partner" generico.
    getParentProfile(),
    // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: stessa
    // getResponsibilitiesForParent() già usata dal Planner (Chi fa cosa?,
    // NON modificata) — qui serve per calcolare il gap di coordinamento
    // stagionale con lo stesso helper puro (computeCoordinationGap).
    getResponsibilitiesForParent(),
    getKidsBookedDaysForWeek(weekdayDatesUnion),
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
      todayResponsibilities={todayResponsibilities}
      parentRole={profile.parentRole}
      coordinationSignal={coordinationSignal}
      profileIncomplete={profileIncomplete}
      hasKids={kids.length > 0}
      // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: dati grezzi per il
      // gap di coordinamento stagionale, calcolato lato client (stessa
      // convenzione di computeHeroWeeksSummary/priorityWeek: raw data via
      // props, derivato via useMemo — vedi PlannerClient.tsx).
      responsibilities={responsibilities}
      coordinationBookedDays={coordinationBookedDays}
      // Addendum Sezione B — banner demo-mode per MOCK_DEMO, stesso criterio
      // di app/(main)/page.tsx (vedi commento li' per il rischio coperto).
      // isSupabaseConfigured qui e' gia' garantito true (il ramo false
      // ritorna prima, riga ~20).
      activitiesAreMockFallback={isMockActivitiesArray(activities)}
    />
  );
}
