// "Le mie prenotazioni" (richiesta da Fabrizio per la v1): elenco reale delle
// prenotazioni del genitore — attività, settimane, bambini, importo e stato.
// Ora include anche i dati necessari per annullare/modificare una
// prenotazione (richiesta di Fabrizio: "SOLO PER TESTARE la possibilità di
// modificare una prenotazione così posso verificare cosa succede lato
// gestore"), rispettando la finestra di cancellazione configurabile dal
// singolo centro (centers.cancellation_window_days — vedi domanda di
// Fabrizio "entro quanto si può fare? può essere una variabile gestibile da
// ciascun centro estivo?").

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";
// BUG CORRETTO 02/09/2026 (segnalazione Fabrizio) — vedi commento sopra
// RawRow.booking_days e lib/booking-response/effective-decision.ts per la
// ROOT CAUSE ANALYSIS completa (stesso difetto già corretto in
// lib/data/planner.ts).
import { effectiveDayBasedDecision } from "@/lib/booking-response/effective-decision";

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface MyBooking {
  id: string;
  activityId: string; // slug, per il link alla scheda attività
  activityDbId: string | null; // uuid reale — serve per Modifica/Contatta il gestore
  activityName: string;
  // Nome/città del centro che eroga l'attività — usati per il raggruppamento
  // "Centro" e per l'ordinamento "Luogo" nella dashboard "Le mie prenotazioni".
  centerName: string;
  centerCity: string;
  coverImageUrl: string | null;
  emoji: string;
  imgGradient: string;
  weeksLabel: string;
  // Data ISO della prima settimana prenotata (null se per qualche motivo non
  // c'è nessuna settimana associata) — serve solo per l'ordinamento "per
  // settimana" lato client (weeksLabel è già formattata per la UI e non è
  // comoda da riordinare). Segnalazione di Fabrizio: la lista va ordinata/
  // filtrata per settimana, bambino, campus.
  firstWeekStart: string | null;
  // uuid delle settimane attualmente prenotate — usato per precompilare il
  // selettore nella pagina "Modifica prenotazione".
  weekIds: string[];
  // Segnalazione 25/08/2026 (Fabrizio): "Modifica prenotazione" apriva un
  // selettore di SETTIMANE anche per prenotazioni fatte a giorni singoli
  // ("Giorni spot", booking_days) — quel selettore ragiona solo per
  // booking_weeks/activity_weeks, quindi per queste prenotazioni ogni
  // settimana risultava "Non attiva qui" (nessuna activity_weeks configurata)
  // e il totale restava sempre a €0, senza mostrare da nessuna parte i
  // giorni realmente prenotati. isDayBased/dayDates (già calcolati
  // internamente per weeksLabel/daysLabel, mai esposti finora) permettono
  // alla pagina di modifica di mostrare uno stato onesto invece del
  // selettore rotto — vedi ModificaPrenotazioneClient.tsx.
  isDayBased: boolean;
  dayDates: string[];
  // SPRINT 3 (NEXTGEN) — dettaglio COMPLETO delle settimane prenotate (non
  // solo la prima, vedi firstWeekLabel sotto): serve al Planner NEXTGEN per
  // etichettare le sovrapposizioni ("settimana N") a partire da un weekId
  // (lib/nextgen/planner-insights.ts#computeKidOverlaps lavora sui weekId
  // grezzi, che da soli non dicono a quale "Settimana N" corrispondono).
  // Campo puramente ADDITIVO: calcolato dagli stessi weekRows già letti
  // sotto, nessuna nuova query — non tocca nessun campo esistente né i
  // consumer LEGACY che non lo leggono.
  weeks: { id: string; label: string; startDate: string; endDate: string }[];
  // Etichetta canonica "Settimana N" della PRIMA settimana prenotata,
  // ricalcolata dalla data reale (vedi lib/season-weeks.ts) invece che dal
  // testo grezzo di activity_weeks.label — stesso bug (e stessa correzione)
  // già trovato in lib/data/checkin.ts e lib/data/attendance.ts: il gestore
  // può aver scritto a mano un'etichetta incoerente con le date reali. Usata
  // per il raggruppamento "Settimana" nella dashboard.
  firstWeekLabel: string | null;
  // uuid dei bambini coinvolti — usato per il filtro "?kid=" (arrivato da
  // "Già prenotato per [bambino]" in Home), più affidabile del solo nome.
  kidIds: string[];
  kidNames: string[];
  status: BookingStatus;
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
  // Giorni di preavviso richiesti dal centro per annullare/modificare senza
  // dover contattare direttamente il gestore (default 3, personalizzabile in
  // "Il mio centro" lato Gestore).
  cancellationWindowDays: number;
  // Giorni mancanti all'inizio della prima settimana prenotata (negativo se
  // già iniziata). Null se non c'è nessuna settimana associata — in quel
  // caso non applichiamo alcun blocco.
  daysUntilStart: number | null;
  // true se il genitore può ancora annullare/modificare in autonomia (fuori
  // dalla finestra di preavviso il pulsante resta comunque visibile, ma
  // disabilitato con una nota "Contatta il centro").
  canCancelOrModify: boolean;
  // TRAMA ONE Build Sprint 4 (DEC-42) — risposta del Partner, additiva.
  // "pending" per ogni prenotazione mai gestita dal centro (comportamento
  // AS-IS invariato per chi non usa ancora la nuova UI di risposta).
  // "partial" (02/09/2026) — SOLO per prenotazioni a giorni: tutti i giorni
  // decisi dal centro, ma esito misto (alcuni accettati, altri rifiutati).
  // Vedi lib/booking-response/effective-decision.ts.
  partnerDecision: "pending" | "accepted" | "rejected" | "proposed" | "partial";
  // 02/09/2026 — SOLO per prenotazioni a giorni (isDayBased): quanti giorni
  // sono stati accettati sul totale prenotato. Usati per la label "Confermata
  // parzialmente (X di Y giorni)" quando partnerDecision === "partial", così
  // il genitore capisce ESATTAMENTE cosa è confermato senza dover aprire il
  // dettaglio giorno per giorno. 0/0 per le prenotazioni a settimana intera.
  acceptedDayCount: number;
  totalDayCount: number;
  partnerProposalNote: string | null;
  // "Letta" dal punto di vista del genitore — stesso pattern read_by_parent
  // di activity_inquiries: falso quando il centro ha appena risposto, così
  // il genitore vede un badge "il centro ha risposto".
  readByParent: boolean;
  // TRAMA — Wave 3 (31/08/2026, Notifiche): quando il centro ha risposto,
  // serve per ordinare/datare la notifica in modo accurato — created_at è la
  // data della PRENOTAZIONE, non della risposta. Additivo, nessun campo
  // esistente toccato. Null per ogni prenotazione mai gestita dal centro.
  respondedAt: string | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

interface RawCenterRef {
  name: string | null;
  city: string | null;
  cancellation_window_days: number | null;
}

interface RawActivityRef {
  id: string;
  slug: string;
  name: string;
  cover_image_url: string | null;
  emoji: string | null;
  img_gradient: string | null;
  centers: RawCenterRef | RawCenterRef[] | null;
}

interface RawWeekRef {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

// BUG CORRETTO 06/08/2026 (segnalato da Fabrizio: "ho simulato una
// prenotazione e non la trovo da nessuna parte") — una prenotazione a
// giorni singoli (funzionalità "Giorni spot", Sprint 3, booking_days invece
// di booking_weeks) non era affatto persa: compariva in fondo alla lista in
// un gruppo "Senza settimana" con "—" al posto delle date, perché questa
// query leggeva solo booking_weeks. Aggiunto booking_days/activity_days.
interface RawDayRef {
  date: string;
}

interface RawRow {
  id: string;
  status: BookingStatus;
  total_amount: number;
  discount_amount: number;
  created_at: string;
  partner_decision: "pending" | "accepted" | "rejected" | "proposed" | null;
  partner_proposal_note: string | null;
  read_by_parent: boolean | null;
  responded_at: string | null;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { activity_weeks: RawWeekRef | RawWeekRef[] | null }[] | null;
  // BUG CORRETTO 02/09/2026: partner_decision non era selezionato qui (solo a
  // livello di bookings sopra) — vedi lib/booking-response/effective-decision.ts.
  booking_days: { partner_decision: string | null; activity_days: RawDayRef | RawDayRef[] | null }[] | null;
  booking_kids: { kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
}

export async function getMyBookingsForParent(): Promise<MyBooking[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, total_amount, discount_amount, created_at, partner_decision, partner_proposal_note, read_by_parent, responded_at, activities ( id, slug, name, cover_image_url, emoji, img_gradient, centers ( name, city, cancellation_window_days ) ), booking_weeks ( activity_weeks ( id, label, start_date, end_date ) ), booking_days ( partner_decision, activity_days ( date ) ), booking_kids ( kids ( id, name ) )"
    )
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const seasonYear = await getSeasonYear();
  const seasonWeeks = getSeasonWeekRanges(seasonYear);
  function canonicalLabel(w: RawWeekRef): string {
    const match = seasonWeeks.find((sw) =>
      overlaps(w.start_date, w.end_date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
    );
    return match ? `Settimana ${match.index}` : w.label;
  }

  return (data as RawRow[]).map((row) => {
    const activity = firstOf(row.activities);
    const center = firstOf(activity?.centers ?? null);
    const weekRows = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is RawWeekRef => Boolean(w))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    // Prenotazione a giorni singoli (booking_days, "Giorni spot" — Sprint 3):
    // niente booking_weeks, quindi senza questo ramo weeksLabel/firstWeekLabel
    // restavano "—"/null e la prenotazione finiva in un gruppo "Senza
    // settimana" con nessuna data visibile, pur essendo salvata
    // correttamente (vedi commento sopra RawDayRef).
    const dayRows = (row.booking_days ?? [])
      .map((bd) => firstOf(bd.activity_days))
      .filter((d): d is RawDayRef => Boolean(d))
      .map((d) => d.date)
      .sort();
    const isDayBased = weekRows.length === 0 && dayRows.length > 0;
    const daysLabel = isDayBased ? dayRows.map((d) => formatDateShort(d)).join(", ") : null;

    // BUG CORRETTO 02/09/2026 (segnalazione Fabrizio, Sett.14 "Prova FP"): per
    // le prenotazioni a giorni, row.partner_decision resta "pending" per
    // sempre (applyDayDecision scrive solo su booking_days.partner_decision,
    // mai sul campo a livello di prenotazione) — qui si aggrega la decisione
    // vera dai singoli giorni invece di fidarsi di quel campo. Per le
    // prenotazioni a settimana intera (row.partner_decision È la risposta
    // autoritativa, scritta da respondToBookingAction) il comportamento resta
    // INVARIATO. Vedi lib/booking-response/effective-decision.ts.
    const effectivePartnerDecision = isDayBased
      ? effectiveDayBasedDecision(
          (row.booking_days ?? []).map((bd) => bd.partner_decision),
          row.partner_decision ?? "pending"
        )
      : (row.partner_decision ?? "pending");
    // Conteggio per la label "Confermata parzialmente (X di Y giorni)" —
    // 0/0 per le prenotazioni a settimana intera (isDayBased false).
    const totalDayCount = isDayBased ? (row.booking_days ?? []).length : 0;
    const acceptedDayCount = isDayBased
      ? (row.booking_days ?? []).filter((bd) => bd.partner_decision === "accepted").length
      : 0;

    const weeksLabel =
      weekRows
        .map((w) => `${canonicalLabel(w)} (${formatDateShort(w.start_date)}–${formatDateShort(w.end_date)})`)
        .join(", ") || daysLabel || "—";
    const firstWeekLabel = weekRows[0] ? canonicalLabel(weekRows[0]) : daysLabel;
    const kidRows = (row.booking_kids ?? []).map((bk) => firstOf(bk.kids)).filter((k): k is { id: string; name: string } => Boolean(k));
    const kidNames = kidRows.map((k) => k.name);
    const kidIds = kidRows.map((k) => k.id);

    const firstWeekStart = weekRows[0]?.start_date ?? dayRows[0] ?? null;
    const cancellationWindowDays = center?.cancellation_window_days ?? 3;
    let daysUntilStart: number | null = null;
    if (firstWeekStart) {
      const msPerDay = 24 * 60 * 60 * 1000;
      daysUntilStart = Math.round(
        (new Date(firstWeekStart + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) / msPerDay
      );
    }
    const canCancelOrModify =
      row.status !== "cancelled" && (daysUntilStart === null || daysUntilStart >= cancellationWindowDays);

    return {
      id: row.id,
      activityId: activity?.slug ?? "",
      activityDbId: activity?.id ?? null,
      activityName: activity?.name ?? "Attività",
      centerName: center?.name ?? "",
      centerCity: center?.city ?? "",
      coverImageUrl: activity?.cover_image_url ?? null,
      emoji: activity?.emoji || "🏫",
      imgGradient: activity?.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      weeksLabel,
      firstWeekStart,
      weekIds: weekRows.map((w) => w.id),
      isDayBased,
      dayDates: dayRows,
      weeks: weekRows.map((w) => ({
        id: w.id,
        label: canonicalLabel(w),
        startDate: w.start_date,
        endDate: w.end_date,
      })),
      firstWeekLabel,
      kidIds,
      kidNames,
      status: row.status,
      totalAmount: row.total_amount,
      discountAmount: row.discount_amount,
      createdAt: row.created_at,
      cancellationWindowDays,
      daysUntilStart,
      canCancelOrModify,
      partnerDecision: effectivePartnerDecision,
      acceptedDayCount,
      totalDayCount,
      partnerProposalNote: row.partner_proposal_note,
      readByParent: row.read_by_parent ?? true,
      respondedAt: row.responded_at,
    };
  });
}
