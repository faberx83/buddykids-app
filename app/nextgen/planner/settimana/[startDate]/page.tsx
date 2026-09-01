import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import { getResponsibilitiesForParent, getKidsBookedDaysForWeek } from "@/lib/data/responsibilities";
import { computeSmartMatches } from "@/lib/nextgen/smart-search";
import {
  computeKidOverlaps,
  computeWeekStatus,
  computePriorityWeekIndex,
  WEEK_STATUS_LABEL,
  weekIndexFromLabel,
} from "@/lib/nextgen/planner-insights";
import { computeRolesToCover } from "@/lib/nextgen/week-roles";
import { WEEKDAYS, MOMENTS } from "@/lib/nextgen/responsibility-options";
import PlannerActivityCardCompact from "@/components/nextgen/PlannerActivityCardCompact";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// PLANNER BETA v1.1 (Wave 2) — "Dettaglio Settimana": nuova route additiva,
// l'unica ammessa dalla revisione. Server Component: nessuno stato locale
// necessario, ogni azione è un link. Risponde in ordine fisso a "questa
// settimana come sono messo? / che cosa manca? / che cosa posso fare ora?"
// (punti 7-8 della revisione) riusando dati e funzioni già esistenti — vedi
// commenti puntuali sotto per ogni riuso.

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MOMENT_ICON: Record<string, string> = { andata: "ti-arrow-right", ritorno: "ti-arrow-left" };

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ startDate: string }>;
}) {
  const { startDate } = await params;

  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per il Dettaglio Settimana.
      </div>
    );
  }

  const seasonYear = await getSeasonYear();
  // Riuso: stesse funzioni dati già lette da app/nextgen/planner/page.tsx —
  // nessuna nuova query oltre a getKidsBookedDaysForWeek (generalizzazione
  // di getKidsWithActivityToday, stessa fonte di verità booking_weeks/
  // booking_days già usata da "Chi fa cosa?", vedi lib/data/responsibilities.ts).
  const [planner, bookings, kids, activities, availabilityByWeek, responsibilities] = await Promise.all([
    getPlannerData(),
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getActivityAvailabilityByWeek(seasonYear),
    getResponsibilitiesForParent(),
  ]);

  // Valida startDate: deve corrispondere a una SeasonWeek reale della
  // stagione corrente, altrimenti 404 (punto 7 della revisione).
  const week = planner.weeks.find((w) => w.startDate === startDate);
  if (!week) notFound();

  const todayIso = new Date().toISOString().slice(0, 10);
  const priorityIndex = computePriorityWeekIndex(planner.weeks, todayIso);
  const overlaps = computeKidOverlaps(bookings);
  const hasOverlap = overlaps.some((o) => weekIndexFromLabel(o.weekLabel) === week.index);
  const status = computeWeekStatus(
    { ...week, isPast: week.endDate < todayIso },
    kids.length,
    hasOverlap,
    week.index === priorityIndex
  );

  // Punto 10-13 della revisione — "Organizzazione Andata/Ritorno": calcolo
  // per singolo child-day realmente prenotato (mai "5 giorni × N bambini"),
  // chiave kid_id+weekday+moment, confrontato con week_responsibilities.
  const weekdayDates = WEEKDAYS.map((wd) => addDaysIso(week.startDate, wd.dayOffset));
  const bookedDays = await getKidsBookedDaysForWeek(weekdayDates);
  const roles = computeRolesToCover(week.startDate, bookedDays, responsibilities);

  // Punto 15-16 — suggerimento solo per settimane non ancora coperte, mai
  // per una settimana già coperta (niente nuova acquisizione proposta).
  const recommendations = !week.covered
    ? computeSmartMatches(activities, kids, {
        uncoveredWeekStart: week.startDate,
        availabilityByWeek,
      }).slice(0, 4)
    : [];
  const [mainRecommendation, ...otherRecommendations] = recommendations;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title={`Settimana ${week.index}`} backHref="/nextgen/planner" showBrandIcon />
      <div className="px-5 py-4">
        <NextgenBadge />

        {/* 1-2. Date, Stato — punto 8 della revisione. TRAMA BETA v1.1.1
            (UI Refinement, punto 7) — "Settimana N" NON va ripetuta qui:
            è già il titolo di PageHeader sopra ("dominante" una sola
            volta). Questo blocco mostra solo il range date + lo stato,
            più compatto (p-3.5 invece di p-4, mb-3 invece di mb-4) per
            portare Copertura/Organizzazione above-the-fold prima. */}
        <div className="mb-3 rounded-2xl bg-white p-3.5">
          <div className="mb-1 font-poppins text-sm font-bold text-ink">{week.dateRange}</div>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
            <i className="ti ti-info-circle text-[13px]" />
            {WEEK_STATUS_LABEL[status]}
          </div>
          {hasOverlap && (
            <p className="mt-2 text-[12px] font-medium text-[#9a6b00]">
              Attenzione: risulta una sovrapposizione da controllare per questa settimana.{" "}
              <Link href="/nextgen/prenotazioni" className="font-bold underline">
                Gestisci in Le mie prenotazioni
              </Link>
            </p>
          )}
        </div>

        {/* 3. Copertura — punto 9: dati sintetici REALI, nessuna percentuale
            inventata. "Bambini coperti" viene da coveredKids (stesso dato
            usato dalla Timeline), "giorni coperti per bambino" da
            bookedDays (child-day reale, stessa fonte del blocco
            Organizzazione sotto). */}
        <div className="mb-3 rounded-2xl bg-white p-3.5">
          <div className="mb-1.5 font-poppins text-[13px] font-bold text-ink">Copertura</div>
          <p className="text-[12.5px] font-medium text-ink-2">
            {week.coveredKids.length} di {kids.length} bambini coperti questa settimana
          </p>
          {bookedDays.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1">
              {bookedDays.map((k) => (
                <p key={k.kidId} className="text-[11.5px] text-ink-3">
                  {k.kidName}: {k.dates.length} di {WEEKDAYS.length} giorni feriali coperti
                </p>
              ))}
            </div>
          )}
          {kids.length > bookedDays.length && (
            <p className="mt-1.5 text-[11.5px] text-ink-3">
              {kids
                .filter((kid) => !bookedDays.some((b) => b.kidId === kid.id))
                .map((kid) => kid.name)
                .join(", ")}
              {kids.length - bookedDays.length === 1 ? " non ha " : " non hanno "}
              ancora nessuna prenotazione questa settimana.
            </p>
          )}
        </div>

        {/* 4. Organizzazione Andata/Ritorno — punti 10-14. Mostrata SOLO se
            esiste almeno un child-day realmente prenotato. */}
        {roles.hasBookedDays && (
          <div className="mb-3 rounded-2xl bg-white p-3.5">
            <div className="mb-2 font-poppins text-[13px] font-bold text-ink">Organizzazione</div>
            {roles.missingSlots === 0 ? (
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green">
                <i className="ti ti-circle-check-filled text-[14px]" />
                Accompagnamenti organizzati
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {MOMENTS.map((mo) => {
                  const stats = roles.byMoment[mo.value];
                  if (stats.assigned + stats.missing === 0) return null;
                  return (
                    <div key={mo.value} className="flex items-center gap-2 text-[12.5px]">
                      <i className={`ti ${MOMENT_ICON[mo.value]} text-[14px] text-ink-3`} />
                      <span className="font-semibold text-ink">{mo.label}</span>
                      {stats.assigned > 0 && (
                        <span className="flex items-center gap-1 text-green">
                          <i className="ti ti-check text-[12px]" />
                          {stats.assigned} assegnat{stats.assigned === 1 ? "a" : "e"}
                        </span>
                      )}
                      {stats.missing > 0 && (
                        <span className="flex items-center gap-1 text-[#9a6b00]">
                          <i className="ti ti-alert-triangle text-[12px]" />
                          {stats.missing} da organizzare
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {roles.missingSlots > 0 && (
              // Punto 14 — porta al Calendario/Chi fa cosa nel contesto
              // della settimana selezionata: riuso del deep-link già
              // esistente (?mode=calendario), che apre già il riquadro
              // Calendario dentro Organizzazione (PlannerClient.tsx).
              <Link
                href="/nextgen/planner?mode=calendario"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-trama-violet py-2.5 text-[12.5px] font-bold text-white active:scale-[0.98]"
              >
                Organizza chi accompagna
              </Link>
            )}
          </div>
        )}

        {/* 5-6. Suggerimento principale + Alternative — punti 15-16.
            TRAMA BETA v1.1.1 (UI Refinement, punto 8) — sia il
            suggerimento principale sia le alternative usano ora la STESSA
            variante compatta (PlannerActivityCardCompact), invece della
            ActivityCard piena di Scopri per il principale + una riga
            hand-rolled diversa per le alternative: un solo componente
            condiviso, coerenza visiva, meno codice duplicato. */}
        {week.covered ? (
          <Link
            href={week.bookingId ? `/nextgen/prenotazioni?bookingId=${week.bookingId}` : "/nextgen/prenotazioni"}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-trama-violet py-3 text-[13.5px] font-bold text-white active:scale-[0.98]"
          >
            Vai alla prenotazione
          </Link>
        ) : (
          <>
            {mainRecommendation && (
              <div className="mb-2">
                <div className="mb-1.5 font-poppins text-sm font-bold text-ink">Suggerimento principale</div>
                {mainRecommendation.reasons.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1 px-1">
                    {mainRecommendation.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-trama-lilac/20 px-2 py-0.5 text-[10px] font-semibold text-trama-violet"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                <PlannerActivityCardCompact
                  activity={mainRecommendation.activity}
                  matchPercent={Math.min(99, Math.round(mainRecommendation.score))}
                  weekStartDate={week.startDate}
                />
              </div>
            )}
            {otherRecommendations.length > 0 && (
              <div className="mb-4">
                <div className="mb-1.5 font-poppins text-[13px] font-bold text-ink">Altre opzioni</div>
                <div className="flex flex-col gap-1.5">
                  {otherRecommendations.map((m) => (
                    <PlannerActivityCardCompact
                      key={m.activity.id}
                      activity={m.activity}
                      matchPercent={Math.min(99, Math.round(m.score))}
                      weekStartDate={week.startDate}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Link verso Scopri per il resto delle opzioni — griglia
                completa, filtri, mappa: quella resta esclusiva di Scopri
                (punto 20 della revisione), qui solo un elenco compatto. */}
            <Link
              href={`/nextgen/search?week=${week.startDate}`}
              className="mb-4 flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-trama-violet active:bg-black/[0.04]"
            >
              Vedi tutte in Scopri
              <i className="ti ti-chevron-right text-[13px]" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
