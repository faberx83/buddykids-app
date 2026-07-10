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

interface RawRow {
  id: string;
  status: BookingStatus;
  total_amount: number;
  discount_amount: number;
  created_at: string;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { activity_weeks: RawWeekRef | RawWeekRef[] | null }[] | null;
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
      "id, status, total_amount, discount_amount, created_at, activities ( id, slug, name, cover_image_url, emoji, img_gradient, centers ( name, city, cancellation_window_days ) ), booking_weeks ( activity_weeks ( id, label, start_date, end_date ) ), booking_kids ( kids ( id, name ) )"
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
    const weeksLabel =
      weekRows
        .map((w) => `${canonicalLabel(w)} (${formatDateShort(w.start_date)}–${formatDateShort(w.end_date)})`)
        .join(", ") || "—";
    const firstWeekLabel = weekRows[0] ? canonicalLabel(weekRows[0]) : null;
    const kidRows = (row.booking_kids ?? []).map((bk) => firstOf(bk.kids)).filter((k): k is { id: string; name: string } => Boolean(k));
    const kidNames = kidRows.map((k) => k.name);
    const kidIds = kidRows.map((k) => k.id);

    const firstWeekStart = weekRows[0]?.start_date ?? null;
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
    };
  });
}
