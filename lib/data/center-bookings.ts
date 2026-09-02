// TRAMA ONE Build Sprint 4 (DEC-42) — Inbox prenotazioni del Partner: la
// prima metà dell'unificazione "state machine Request" richiesta da
// SPRINT_GOVERNANCE.md (WRAP, non REPLACE — vedi DEC-15/DEC-42). Stesso
// principio di lib/data/inquiries.ts::getInquiriesForCenter (ticketing), qui
// applicato a public.bookings/booking_days invece di activity_inquiries:
// entità diversa, stesso pattern di lettura scoperto in quel file (scoping
// per centro via getCenterContext, embed relazionali, mapping a un tipo
// piatto per il client).
//
// Nota di scope: questo file copre SOLO lettura (la Inbox). Le mutazioni
// (accetta/rifiuta/proponi/cancella per giorno) sono in
// app/actions/booking-response.ts (Task #344/#347).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";

export type PartnerDecision = "pending" | "accepted" | "rejected" | "proposed";
// "waitlisted" (migrazione 34, NON applicata da questa sessione — vedi
// supabase/migration_34_booking_days_waitlist.sql): il giorno era pieno al
// momento del tentativo di accettazione, la richiesta resta in coda invece
// di essere rifiutata. Finché la migrazione non è applicata, il codice
// applicativo non scrive mai questo valore (degrada a "pending" con un
// messaggio, vedi app/actions/booking-response.ts) — il tipo lo include già
// per non dover ritoccare data layer/UI una seconda volta.
export type DayPartnerDecision = "pending" | "accepted" | "rejected" | "waitlisted";
export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface CenterBookingDay {
  activityDayId: string;
  date: string; // activity_days.date
  price: number;
  partnerDecision: DayPartnerDecision;
  partnerNote: string | null;
  // Migrazione 34: valorizzato solo quando partnerDecision === "waitlisted",
  // usato per ordinare la promozione manuale (il più vecchio in coda prima).
  waitlistedAt: string | null;
}

export interface CenterBookingWeek {
  weekId: string;
  startDate: string;
}

export interface CenterBooking {
  id: string;
  status: BookingStatus;
  partnerDecision: PartnerDecision;
  partnerProposalNote: string | null;
  partnerProposedAt: string | null;
  respondedAt: string | null;
  cancelledBy: "parent" | "center" | null;
  readByCenter: boolean;
  readByParent: boolean;
  activityId: string; // slug
  activityName: string;
  parentName: string;
  parentEmail: string;
  kidNames: string[];
  totalAmount: number;
  discountAmount: number;
  shuttleIncluded: boolean;
  createdAt: string;
  weeks: CenterBookingWeek[];
  days: CenterBookingDay[];
  // true se questa è una prenotazione "Giorni spot" (ha righe in
  // booking_days) — determina se la Inbox mostra i controlli di
  // accettazione per giorno o per l'intera prenotazione (settimana intera).
  isDayBased: boolean;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawRow {
  id: string;
  status: BookingStatus;
  partner_decision: PartnerDecision;
  partner_proposal_note: string | null;
  partner_proposed_at: string | null;
  responded_at: string | null;
  cancelled_by: "parent" | "center" | null;
  read_by_center: boolean;
  read_by_parent: boolean;
  total_amount: number;
  discount_amount: number;
  shuttle_included: boolean;
  created_at: string;
  activities: { slug: string; name: string } | { slug: string; name: string }[] | null;
  profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
  booking_weeks: { week_id: string; activity_weeks: { start_date: string } | { start_date: string }[] | null }[] | null;
  booking_days: {
    activity_day_id: string;
    price: number;
    partner_decision: DayPartnerDecision;
    partner_note: string | null;
    // Migrazione 34 (waitlisted_at) — colonna additiva NON ancora applicata
    // da questa sessione. Selezionarla comunque qui è sicuro: PostgREST la
    // legge come null finché la colonna non esiste? No — se la colonna non
    // esiste la query PostgREST intera fallirebbe con "colonna
    // inesistente". Per questo NON è inclusa in SELECT sotto finché
    // Fabrizio non applica la migrazione (vedi commento su SELECT). Il
    // campo resta nel tipo/mapping, valorizzato a null lato client, per non
    // dover ritoccare data layer/UI una seconda volta al momento
    // dell'applicazione.
    activity_days: { date: string } | { date: string }[] | null;
  }[] | null;
}

// NOTA migrazione 34 (supabase/migration_34_booking_days_waitlist.sql, NON
// applicata): "waitlisted_at" non è incluso in questo SELECT perché
// PostgREST fa fallire l'INTERA query se una colonna richiesta non esiste
// ancora nel DB — a differenza di una colonna JS opzionale, qui non c'è un
// modo sicuro di "provare a leggerla" senza rischiare di rompere l'intera
// Inbox prenotazioni finché la migrazione non è applicata. Quando Fabrizio
// applica migration_34, aggiungere ", waitlisted_at" dentro
// "booking_days ( ... )" qui sotto e leggere bd.waitlisted_at in mapRow
// invece del "null" fisso attuale — RawRow lo ha già in tipo per allora.
const SELECT = `
  id, status, partner_decision, partner_proposal_note, partner_proposed_at,
  responded_at, cancelled_by, read_by_center, read_by_parent, total_amount,
  discount_amount, shuttle_included, created_at,
  activities ( slug, name ),
  profiles!parent_id ( full_name, email ),
  booking_kids ( kids ( name ) ),
  booking_weeks ( week_id, activity_weeks ( start_date ) ),
  booking_days ( activity_day_id, price, partner_decision, partner_note, activity_days ( date ) )
`;

function mapRow(row: RawRow): CenterBooking {
  const activity = firstOf(row.activities);
  const parent = firstOf(row.profiles);
  const days = (row.booking_days ?? []).map((bd) => ({
    activityDayId: bd.activity_day_id,
    date: firstOf(bd.activity_days)?.date ?? "",
    price: bd.price,
    partnerDecision: bd.partner_decision,
    partnerNote: bd.partner_note,
    // waitlisted_at non è nel SELECT (vedi nota sopra, migrazione 34 non
    // applicata) — fisso a null finché non lo sarà.
    waitlistedAt: null as string | null,
  }));

  return {
    id: row.id,
    status: row.status,
    partnerDecision: row.partner_decision,
    partnerProposalNote: row.partner_proposal_note,
    partnerProposedAt: row.partner_proposed_at,
    respondedAt: row.responded_at,
    cancelledBy: row.cancelled_by,
    readByCenter: row.read_by_center,
    readByParent: row.read_by_parent,
    activityId: activity?.slug ?? "",
    activityName: activity?.name ?? "Attività",
    parentName: parent?.full_name || "Genitore",
    parentEmail: parent?.email ?? "",
    kidNames: (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids)?.name)
      .filter((n): n is string => Boolean(n)),
    totalAmount: row.total_amount,
    discountAmount: row.discount_amount,
    shuttleIncluded: row.shuttle_included,
    createdAt: row.created_at,
    weeks: (row.booking_weeks ?? []).map((bw) => ({
      weekId: bw.week_id,
      startDate: firstOf(bw.activity_weeks)?.start_date ?? "",
    })),
    days,
    isDayBased: days.length > 0,
  };
}

// Tutte le prenotazioni delle attività del centro (o di tutti i centri per
// l'Admin piattaforma — stesso bypass is_platform_admin() già in uso altrove,
// qui applicato via RLS: la query non filtra esplicitamente per centro,
// affidandosi alla policy "Bookings: il centro vede le prenotazioni delle
// proprie attività" / bypass Admin, stesso principio di getInquiriesForCenter
// che invece filtra esplicitamente per activityIds — qui usiamo lo stesso
// filtro esplicito per coerenza e per poter escludere il centro senza
// affidarsi solo a RLS in caso di query lato client futura).
export async function getBookingsForCenter(): Promise<CenterBooking[]> {
  if (!isSupabaseConfigured) return [];

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return [];

  const supabase = await createClient();

  let activityIds: string[] | null = null;
  if (centerDbId) {
    const { data: acts } = await supabase.from("activities").select("id").eq("center_id", centerDbId);
    activityIds = (acts ?? []).map((a) => a.id as string);
    if (activityIds.length === 0) return [];
  }

  let query = supabase.from("bookings").select(SELECT).order("created_at", { ascending: false });
  if (activityIds) query = query.in("activity_id", activityIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as RawRow[]).map(mapRow);
}

// Conteggio prenotazioni non lette dal centro (badge nav, stesso pattern di
// getUnreadCountForCenter in lib/data/inquiries.ts — PCR-029, vincolo P0).
export async function getUnreadBookingsCountForCenter(): Promise<number> {
  const all = await getBookingsForCenter();
  return all.filter((b) => !b.readByCenter && b.status !== "cancelled").length;
}

// Prenotazione singola per una pagina di dettaglio futura, se necessaria —
// non usata dalla Inbox lista (che mostra tutto), tenuta per simmetria con
// il resto del data layer prenotazioni.
export async function getCenterBookingById(bookingId: string): Promise<CenterBooking | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").select(SELECT).eq("id", bookingId).single();
  if (error || !data) return null;
  return mapRow(data as unknown as RawRow);
}
