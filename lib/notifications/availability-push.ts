import "server-only";

// TRAMA FINAL HARDENING §4-8 (feature nuova, wave "chiusura incoerenze +
// consolidamento AVAILABILITY/CHECK-IN", 04/09/2026) — push "è tornato un
// posto" quando una settimana/giorno passa da 0 posti a >0 posti reali.
//
// SCELTE DI SCOPO DOCUMENTATE (nessuna decisione presa in silenzio):
//
// 1) TRIGGER — event-driven, agganciato DIRETTAMENTE al punto di mutazione
//    reale (lib/capacity/service.ts::releaseSpot, chiamato da
//    releaseWeekCapacity/releaseDayCapacity), MAI un cron. Motivo pratico:
//    il piano Hobby di Vercel limita i cron a 1 esecuzione/giorno (vedi
//    vercel.json, già scoperto per travel-reminders) — un cron che
//    "riscansiona" la disponibilità periodicamente non potrebbe comunque
//    rilevare una transizione 0→1 in tempo utile. Il chiamante (capacity/
//    service.ts) verifica GIÀ che si tratti di una VERA transizione 0→>0
//    (spots_left era 0 PRIMA di questa specifica mutazione riuscita) — mai
//    per ogni aggiornamento di capacità.
//
// 2) CANDIDATE FAMILIES — "chi ha messo questa attività tra i Preferiti".
//    Nessuna soglia di "match %" arbitraria (l'istruzione esplicita è "non
//    inventare 70%, usa una regola conservativa derivata da ranking/
//    raccomandazione esistente O favorite+raccomandazione, documenta la
//    scelta"): i Preferiti sono l'unico segnale di interesse ESPLICITO e
//    già esistente in questo prodotto per una singola attività (a
//    differenza del "match %" di lib/matching.ts, che è per-bambino/
//    per-lista, non un indice "chi è interessato a QUESTA attività" — usarlo
//    richiederebbe scansionare tutte le famiglie della piattaforma per
//    ricalcolare un punteggio ad ogni rilascio di capacità, costoso e non
//    più "conservativo" di così). Filtrato poi per eleggibilità reale
//    (isAgeEligible, lib/matching.ts — stesso hard cutoff appena introdotto,
//    nessuna soglia parallela) e per "non già coperto" quella settimana/
//    giorno (vedi getKidsAlreadyCoveredForPeriod sotto).
//
// 3) DEDUPLICAZIONE — QUESTO È IL LIMITE DOCUMENTATO PIÙ IMPORTANTE. La
//    tabella product_events (migration_20, applicata) è stata valutata e
//    SCARTATA come meccanismo di deduplica per-famiglia: il suo stesso
//    commento di design (lib/telemetry/known-events.ts) dichiara
//    esplicitamente "nessun user_id/PII, solo conteggi aggregati... MAI la
//    cronologia di un singolo utente" — incorporarvi un parentId per
//    deduplicare per-famiglia violerebbe quel vincolo di design already
//    documentato, non lo aggirerebbe. push_subscriptions (migration_31) non
//    ha alcun campo per tracciare "episodi" di disponibilità per attività.
//    Nessun'altra tabella esistente si presta.
//    GARANZIA REALE fornita da questa implementazione (senza nuova
//    persistenza): l'invio è agganciato DENTRO la mutazione CAS di
//    releaseSpot — SOLO la chiamata che fa passare spots_left da 0 a >0 può
//    rilevare quella transizione (il CAS garantisce che unicamente quella
//    scrittura vede row.spots_left===0 al momento del successo), quindi UNA
//    transizione reale genera esattamente UNA chiamata a questo modulo. Il
//    gap NON coperto: se lo stesso identico processo di invio venisse
//    rieseguito da un livello più esterno (retry di rete, doppio submit
//    della stessa azione) DOPO che l'invio push è già partito ma prima che
//    la funzione ritorni, potrebbe ripartire una seconda volta — rischio
//    residuo basso (nessun retry automatico esiste oggi in questo punto del
//    codice) ma non formalmente escluso senza persistenza dedicata.
//    MIGRAZIONE PROPOSTA (NON scritta, NON applicata — solo per il report
//    finale se Fabrizio vorrà chiuderlo in una wave futura): una tabella
//    dedicata tipo `availability_push_log(parent_id, activity_id,
//    scope_type, scope_id, episode_started_at, sent_at)` con UNIQUE
//    (parent_id, activity_id, scope_type, scope_id, episode_started_at).
//
// 4) COPERTURA "week ancora scoperta in Planner" — unificata con "famiglia
//    non ha già una prenotazione attiva per quel bambino in quel periodo":
//    un bambino con QUALUNQUE prenotazione attiva (qualunque attività) che
//    si sovrappone al periodo è per definizione "già coperto" per quella
//    settimana/giorno, che è esattamente il significato di "settimana non
//    più scoperta nel Planner" — un solo controllo soddisfa entrambi i
//    criteri della spec invece di due query separate.

import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push/send";
import { isAgeEligible } from "@/lib/matching";
import { overlaps } from "@/lib/season-weeks";

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

export type AvailabilityBackInStockScope =
  | { kind: "week"; activityId: string; weekId: string }
  | { kind: "day"; activityId: string; activityDayId: string };

function ageFromBirthDatePure(birthDate: string | null): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00Z");
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

const MONTH_LABELS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function formatDateIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTH_LABELS_IT[d.getUTCMonth()]}`;
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const jsDay = d.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface RawBookingRow {
  booking_kids: { kid_id: string }[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  booking_days: { activity_days: { date: string } | { date: string }[] | null }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Bambini (di QUALUNQUE famiglia candidata) che hanno già una prenotazione
// ATTIVA (non cancellata, qualunque attività) che copre il periodo dato —
// vedi punto 4) nel commento di testa: soddisfa insieme "già coperto per
// quell'attività" e "settimana non più scoperta nel Planner".
// Esportata (TRAMA FINAL HARDENING §21-23, test locali) SOLO per essere
// testabile in isolamento con un client Supabase fittizio (stesso pattern
// già usato in tests/one/capacity-concurrency.spec.ts) — nessun nuovo
// consumatore reale al di fuori di questo modulo.
export async function getKidsAlreadyCoveredForPeriod(
  service: ServiceClient,
  parentIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<Set<string>> {
  const covered = new Set<string>();
  if (parentIds.length === 0) return covered;

  const { data, error } = await service
    .from("bookings")
    .select(
      "booking_kids ( kid_id ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( activity_days ( date ) )"
    )
    .in("parent_id", parentIds)
    .neq("status", "cancelled");
  if (error || !data) return covered;

  for (const booking of data as unknown as RawBookingRow[]) {
    const kidIds = (booking.booking_kids ?? []).map((bk) => bk.kid_id);
    if (kidIds.length === 0) continue;

    let coversPeriod = false;
    for (const bw of booking.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (week && overlaps(periodStart, periodEnd, week.start_date, week.end_date)) {
        coversPeriod = true;
        break;
      }
    }
    if (!coversPeriod) {
      for (const bd of booking.booking_days ?? []) {
        const day = firstOf(bd.activity_days);
        if (day && day.date >= periodStart && day.date <= periodEnd) {
          coversPeriod = true;
          break;
        }
      }
    }
    if (coversPeriod) for (const kidId of kidIds) covered.add(kidId);
  }

  return covered;
}

/**
 * Da chiamare SOLO quando lib/capacity/service.ts ha appena rilevato una
 * VERA transizione 0 → disponibile (mai per ogni variazione di capacità).
 * Best-effort per costruzione (mai un'eccezione verso il chiamante — stesso
 * principio di sendPushToUser): un fallimento qui non deve mai bloccare
 * l'operazione di dominio (cancellazione, rifiuto, riapertura posti) che ha
 * generato il rilascio di capacità.
 */
export async function notifyAvailabilityBackInStock(scope: AvailabilityBackInStockScope): Promise<void> {
  try {
    const service = createServiceClient();
    if (!service) return;

    const { data: activity } = await service
      .from("activities")
      .select("id, name, slug, age_min, age_max")
      .eq("id", scope.activityId)
      .maybeSingle();
    if (!activity || !activity.slug) return;
    const ageRange = `${activity.age_min ?? 0}-${activity.age_max ?? 99}`;

    let periodStart: string;
    let periodEnd: string;
    let periodLabel: string;
    let deepLink: string;

    if (scope.kind === "week") {
      const { data: week } = await service
        .from("activity_weeks")
        .select("start_date, end_date")
        .eq("id", scope.weekId)
        .maybeSingle();
      if (!week) return;
      periodStart = week.start_date;
      periodEnd = week.end_date;
      periodLabel = `settimana ${formatDateIt(week.start_date)}–${formatDateIt(week.end_date)}`;
      deepLink = `/activity/${activity.slug}?week=${week.start_date}`;
    } else {
      const { data: day } = await service
        .from("activity_days")
        .select("date")
        .eq("id", scope.activityDayId)
        .maybeSingle();
      if (!day) return;
      periodStart = day.date;
      periodEnd = day.date;
      periodLabel = `giorno di ${formatDateIt(day.date)}`;
      deepLink = `/activity/${activity.slug}?week=${mondayOf(day.date)}`;
    }

    // Un periodo già concluso non è più "rilevante" (spec §4: "week/period è
    // future and relevant") — non notificare qualcosa che non è più
    // prenotabile per definizione temporale.
    const todayIso = new Date().toISOString().slice(0, 10);
    if (periodEnd < todayIso) return;

    const { data: favRows, error: favError } = await service
      .from("favorites")
      .select("parent_id")
      .eq("activity_id", scope.activityId);
    if (favError || !favRows || favRows.length === 0) return;
    const parentIds = [...new Set(favRows.map((r) => r.parent_id as string))];

    const { data: kidRows, error: kidError } = await service
      .from("kids")
      .select("id, name, birth_date, parent_id")
      .in("parent_id", parentIds);
    if (kidError || !kidRows || kidRows.length === 0) return;

    const alreadyCoveredKidIds = await getKidsAlreadyCoveredForPeriod(service, parentIds, periodStart, periodEnd);

    for (const parentId of parentIds) {
      const familyKids = kidRows.filter((k) => k.parent_id === parentId);
      const eligibleKid = familyKids.find((k) => {
        if (alreadyCoveredKidIds.has(k.id as string)) return false;
        const age = ageFromBirthDatePure(k.birth_date as string | null);
        return isAgeEligible(age, ageRange);
      });
      if (!eligibleKid) continue;

      await sendPushToUser(parentId, {
        title: "È tornato un posto 👀",
        body: `${activity.name} è di nuovo disponibile per la ${periodLabel}`,
        deepLink,
      });
    }
  } catch (err) {
    console.error("[availability-push] notifyAvailabilityBackInStock fallita:", err);
  }
}
