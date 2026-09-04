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
// 2) CANDIDATE FAMILIES — AGGIORNATO in TRAMA FINAL HARDENING CLOSURE §4
//    (04/09/2026). La wave precedente limitava i candidati a "chi ha questa
//    attività nei Preferiti", per evitare di scansionare tutte le famiglie
//    della piattaforma. Requisito esplicito di questa closure wave: un
//    bambino con un bisogno ancora scoperto per cui questa attività è una
//    "buona raccomandazione" deve poter ricevere la push ANCHE se la
//    famiglia non l'ha mai messa nei Preferiti — "NON creare un nuovo
//    algoritmo di matching, RIUSA la recommendation/smart matching logic
//    canonica". Candidate kid ora = Preferiti(attività) OR
//    matchPercentForKid(kid, attività) >= 40 — la STESSA soglia già usata
//    da lib/nextgen/smart-search.ts per decidere il reason "Piace a
//    [bambino]" (computeSmartMatches, "if (percent >= 40)
//    matchingKidNames.push(...)"), non un numero nuovo inventato qui.
//    matchPercentForKid già incorpora isAgeEligible come hard cutoff (Fix
//    #133/§20 di questa wave: fuori range => 0, mai un punteggio parziale),
//    quindi il ramo "recommendation" non può mai proporre un'attività
//    age-incompatibile — il controllo isAgeEligible esplicito sotto resta
//    comunque anche per il ramo "favorite" (un preferito non è mai
//    un'eccezione all'età). "Costoso": la scansione è SOLO sui bambini
//    (tabella kids, poche centinaia di righe in un pilot), UNA volta per
//    attività al momento della sua transizione 0→disponibile — mai per
//    ogni attività della piattaforma, mai per ogni richiesta HTTP — e il
//    punteggio (lib/matching.ts) è puro/sincrono, nessuna query aggiuntiva
//    per bambino. Filtrato poi per eleggibilità reale (isAgeEligible) e per
//    "non già coperto" quella settimana/giorno (vedi
//    getKidsAlreadyCoveredForPeriod sotto) — invariato.
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
import { isAgeEligible, matchPercentForKid } from "@/lib/matching";
import { overlaps } from "@/lib/season-weeks";
import type { Activity, Kid } from "@/lib/types";

// Stessa soglia di lib/nextgen/smart-search.ts (computeSmartMatches) — vedi
// punto 2) nel commento di testa: non un numero nuovo, lo stesso già usato
// per decidere "Piace a [bambino]" in Cerca/Scopri.
const RECOMMENDATION_THRESHOLD = 40;

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

    // TRAMA FINAL HARDENING CLOSURE §4 — colonne in più (description,
    // rating, activity_tags) rispetto alla wave precedente: servono per
    // eseguire il VERO matchPercentForKid (lib/matching.ts), non solo il
    // taglio età, sul ramo "recommendation" sotto. Stessa forma minima già
    // usata da mapRow (lib/data/activities.ts), qui senza i campi non
    // rilevanti per il punteggio (prezzo, orari, ecc.).
    const { data: activityRow } = await service
      .from("activities")
      .select(
        "id, name, slug, age_min, age_max, description, rating, activity_tags ( tags ( label ) )"
      )
      .eq("id", scope.activityId)
      .maybeSingle();
    if (!activityRow || !activityRow.slug) return;
    const activity = activityRow as {
      id: string;
      name: string;
      slug: string;
      age_min: number | null;
      age_max: number | null;
      description: string | null;
      rating: number | null;
      activity_tags: { tags: { label: string } | { label: string }[] | null }[] | null;
    };
    const ageRange = `${activity.age_min ?? 0}-${activity.age_max ?? 99}`;
    // "Activity"-shaped minimo sufficiente per matchPercentForKid (ageRange,
    // interessi via tags/description/name, rating) — i campi non usati dal
    // punteggio (prezzo, indirizzo, ecc.) sono irrilevanti qui e omessi.
    const activityForMatching = {
      name: activity.name,
      description: activity.description ?? "",
      ageRange,
      tags: (activity.activity_tags ?? [])
        .map((t) => (Array.isArray(t.tags) ? t.tags[0] : t.tags))
        .filter((t): t is { label: string } => Boolean(t))
        .map((t) => ({ label: t.label })),
      rating: activity.rating ?? 0,
    } as unknown as Activity;

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

    const { data: favRows } = await service
      .from("favorites")
      .select("parent_id")
      .eq("activity_id", scope.activityId);
    const favoriteParentIds = new Set((favRows ?? []).map((r) => r.parent_id as string));

    // TRAMA FINAL HARDENING CLOSURE §4 — TUTTI i bambini della piattaforma
    // (non solo quelli delle famiglie che hanno già messo l'attività nei
    // Preferiti), per poter valutare il ramo "recommendation" sotto. Scala
    // pilot (poche centinaia di righe), una sola query, MAI ripetuta per
    // bambino — vedi commento di scope in testa al file.
    const { data: kidRows, error: kidError } = await service
      .from("kids")
      .select("id, name, birth_date, parent_id, interests");
    if (kidError || !kidRows || kidRows.length === 0) return;

    const allParentIds = [...new Set(kidRows.map((k) => k.parent_id as string))];
    const alreadyCoveredKidIds = await getKidsAlreadyCoveredForPeriod(service, allParentIds, periodStart, periodEnd);

    // Candidati per famiglia: Preferiti(attività) OR raccomandazione valida
    // (matchPercentForKid >= RECOMMENDATION_THRESHOLD) per almeno un
    // bambino di quella famiglia — vedi punto 2) in testa al file. Un solo
    // giro sui bambini invece di due branch separati: per ciascun bambino
    // calcoliamo comunque il punteggio reale (serve anche per scegliere,
    // in caso di più fratelli idonei, quello con il match migliore, non
    // semplicemente il primo).
    const byParent = new Map<string, { kidId: string; kidName: string; percent: number }[]>();
    for (const k of kidRows) {
      const kidId = k.id as string;
      const parentId = k.parent_id as string;
      if (alreadyCoveredKidIds.has(kidId)) continue;

      const age = ageFromBirthDatePure(k.birth_date as string | null);
      if (!isAgeEligible(age, ageRange)) continue;

      const isFavoriteFamily = favoriteParentIds.has(parentId);
      const kidForMatching = { age, interests: (k.interests as string[] | null) ?? [] } as unknown as Kid;
      const percent = matchPercentForKid(kidForMatching, activityForMatching);
      const isRecommended = percent >= RECOMMENDATION_THRESHOLD;
      if (!isFavoriteFamily && !isRecommended) continue;

      const list = byParent.get(parentId) ?? [];
      list.push({ kidId, kidName: k.name as string, percent });
      byParent.set(parentId, list);
    }

    for (const [parentId, kids] of byParent) {
      // Bambino con il punteggio migliore fra quelli idonei della famiglia
      // — una push, non una per figlio (stesso principio "no spam" già
      // seguito per la push di check-in).
      kids.sort((a, b) => b.percent - a.percent);
      const best = kids[0];
      if (!best) continue;

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
