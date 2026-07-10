import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities } from "@/lib/data/activities";
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

  const [planner, bookings, kids, activities] = await Promise.all([
    getPlannerData(),
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
  ]);

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    fullName = profile?.full_name ?? null;
  }

  // Suggerimenti "per riempire i buchi": solo se ci sono settimane scoperte
  // (altrimenti la famiglia è già organizzata, niente da consigliare — vedi
  // la logica di rassicurazione richiesta). Match aggregato multi-bambino:
  // per ogni attività prendiamo il punteggio migliore tra i bambini, così un
  // consiglio adatto anche a un solo figlio non viene scartato. Nessun filtro
  // di disponibilità per-settimana qui (limite noto: lib/matching.ts non ha
  // ancora un concetto di "libera proprio in quella settimana scoperta" —
  // buon candidato per raffinare nello Sprint 2 "Ricerca e scoperta").
  const hasGaps = planner.firstUncoveredIndex !== null;
  const recommendations = hasGaps
    ? Array.from(
        activities
          .flatMap((a) =>
            kids.map((kid) => ({ activity: a, kidName: kid.name, matchPercent: computeMatchesForKid(kid, [a])[0].matchPercent }))
          )
          .reduce((map, entry) => {
            const existing = map.get(entry.activity.id);
            if (!existing || existing.matchPercent < entry.matchPercent) map.set(entry.activity.id, entry);
            return map;
          }, new Map<string, { activity: (typeof activities)[number]; kidName: string; matchPercent: number }>())
          .values()
      )
        .sort((a, b) => b.matchPercent - a.matchPercent)
        .slice(0, 3)
    : [];

  return (
    <HomeDashboardClient
      firstName={fullName?.split(" ")[0] ?? null}
      planner={planner}
      bookings={bookings}
      recommendations={recommendations}
    />
  );
}
