import "server-only";

// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "rendere Admin
// utilizzabile per gestire la beta: vedere cosa richiede un intervento,
// trovare il caso preciso, capire chi deve agire e ricostruire lo storico".
// Iniziativa: claude/INIZIATIVA_admin_operativo.md.
//
// Letture Admin in SOLA LETTURA, tutte dietro il controllo platform_admin
// fatto qui, lato server (stesso principio di lib/data/pilot-users.ts e
// lib/data/beta-cockpit.ts: il controllo del layout è lato client). Chi non è
// Admin riceve elenchi vuoti e null, mai dati. La logica sta in
// lib/admin-ops/* (pura, testata).
//
// Riuso: stesse tabelle e relazioni di lib/data/center-bookings.ts (Inbox del
// centro), lib/data/day-confirmed.ts (posti confermati) e
// lib/data/admin-inquiries.ts; nessuna tabella nuova, nessuna scrittura.
// Colonne recenti (capacity_units, migration 60; is_test_fixture, migration
// 47): se mancano (errore 42703) si rilegge senza, come nel resto del codice.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AdminBookingRow, BookingStatus, DayDecision } from "@/lib/admin-ops/bookings";
import type { AdminInquiryRow, InquiryStatus } from "@/lib/admin-ops/inquiries";
import type { PartnerDecision } from "@/lib/booking-response/effective-decision";
import type { AccountRef } from "@/lib/admin-ops/invitations";
import { findAccountsByEmail } from "./waitlist";

type Session = Awaited<ReturnType<typeof createClient>>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Client di sessione solo se l'utente è davvero platform_admin. */
export async function adminSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_admin" ? supabase : null;
}

// ── Prenotazioni ──────────────────────────────────────────────────────────

const BOOKING_SELECT = (withNew: boolean) => `
  id, status, partner_decision, created_at, responded_at, cancelled_by, total_amount, discount_amount,
  activities ( id, slug, name, booking_mode, price_per_week, center_id, centers ( id, name${withNew ? ", is_test_fixture" : ""} ) ),
  profiles!parent_id ( full_name, email ),
  booking_kids ( kids ( name ) ),
  booking_days ( activity_day_id, price, partner_decision, capacity_decremented${withNew ? ", capacity_units" : ""}, activity_days ( date ) ),
  booking_weeks ( week_id, capacity_decremented${withNew ? ", capacity_units" : ""}, activity_weeks ( start_date, end_date ) )
`;

interface RawCenter {
  id: string;
  name: string | null;
  is_test_fixture?: boolean | null;
}
interface RawBooking {
  id: string;
  status: BookingStatus;
  partner_decision: PartnerDecision;
  created_at: string;
  responded_at: string | null;
  cancelled_by: "parent" | "center" | null;
  total_amount: number | string | null;
  discount_amount: number | string | null;
  activities:
    | { id: string; slug: string; name: string; booking_mode: string | null; price_per_week: number | string | null; center_id: string | null; centers: RawCenter | RawCenter[] | null }
    | { id: string; slug: string; name: string; booking_mode: string | null; price_per_week: number | string | null; center_id: string | null; centers: RawCenter | RawCenter[] | null }[]
    | null;
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
  booking_days:
    | {
        activity_day_id: string;
        price: number | string | null;
        partner_decision: DayDecision;
        capacity_decremented: boolean | null;
        capacity_units?: number | null;
        activity_days: { date: string } | { date: string }[] | null;
      }[]
    | null;
  booking_weeks:
    | {
        week_id: string;
        capacity_decremented: boolean | null;
        capacity_units?: number | null;
        activity_weeks: { start_date: string; end_date: string | null } | { start_date: string; end_date: string | null }[] | null;
      }[]
    | null;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));

function mapBooking(r: RawBooking): AdminBookingRow {
  const a = firstOf(r.activities);
  const c = firstOf(a?.centers ?? null);
  const p = firstOf(r.profiles);
  const mode = a?.booking_mode;
  return {
    id: r.id,
    status: r.status,
    partnerDecisionRaw: r.partner_decision,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
    cancelledBy: r.cancelled_by,
    totalAmount: num(r.total_amount),
    discountAmount: num(r.discount_amount),
    centerId: c?.id ?? a?.center_id ?? null,
    centerName: c?.name ?? "Centro",
    centerIsTestFixture: Boolean(c?.is_test_fixture),
    activityId: a?.id ?? null,
    activitySlug: a?.slug ?? "",
    activityName: a?.name ?? "Attività",
    bookingMode: mode === "day_only" || mode === "mixed" || mode === "week_only" ? mode : null,
    pricePerWeek: a?.price_per_week === null || a?.price_per_week === undefined ? null : Number(a.price_per_week),
    parentName: p?.full_name || "Genitore",
    parentEmail: p?.email ?? "",
    kidNames: (r.booking_kids ?? []).map((bk) => firstOf(bk.kids)?.name).filter((n): n is string => Boolean(n)),
    days: (r.booking_days ?? [])
      .map((d) => ({
        activityDayId: d.activity_day_id,
        date: firstOf(d.activity_days)?.date ?? "",
        decision: d.partner_decision,
        capacityDecremented: Boolean(d.capacity_decremented),
        units: d.capacity_units ?? null,
        price: num(d.price),
      }))
      .sort((x, y) => x.date.localeCompare(y.date)),
    weeks: (r.booking_weeks ?? [])
      .map((w) => {
        const aw = firstOf(w.activity_weeks);
        return {
          weekId: w.week_id,
          startDate: aw?.start_date ?? "",
          endDate: aw?.end_date ?? aw?.start_date ?? "",
          capacityDecremented: Boolean(w.capacity_decremented),
          units: w.capacity_units ?? null,
        };
      })
      .sort((x, y) => x.startDate.localeCompare(y.startDate)),
  };
}

/** Tutte le prenotazioni (Admin), al più `limit`, le più recenti prima. */
export async function getAdminBookings(opts: { bookingId?: string; activityId?: string; limit?: number } = {}): Promise<AdminBookingRow[]> {
  const supabase = await adminSession();
  if (!supabase) return [];
  const run = async (withNew: boolean) => {
    let q = supabase.from("bookings").select(BOOKING_SELECT(withNew)).order("created_at", { ascending: false }).limit(opts.limit ?? 3000);
    if (opts.bookingId) q = q.eq("id", opts.bookingId);
    if (opts.activityId) q = q.eq("activity_id", opts.activityId);
    return q;
  };
  let res = await run(true);
  if (res.error?.code === "42703") res = await run(false);
  if (res.error || !res.data) return [];
  return (res.data as unknown as RawBooking[]).map(mapBooking);
}

export async function getAdminBooking(id: string): Promise<AdminBookingRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await getAdminBookings({ bookingId: id, limit: 1 });
  return rows[0] ?? null;
}

// ── Messaggi famiglia → centro ───────────────────────────────────────────

interface RawInquiry {
  id: string;
  status: InquiryStatus;
  created_at: string;
  replied_at: string | null;
  last_message_at?: string | null;
  message: string | null;
  reply: string | null;
  activities:
    | { id: string; name: string; center_id: string | null; centers: RawCenter | RawCenter[] | null }
    | { id: string; name: string; center_id: string | null; centers: RawCenter | RawCenter[] | null }[]
    | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
}

export async function getAdminInquiries(): Promise<AdminInquiryRow[]> {
  const supabase = await adminSession();
  if (!supabase) return [];
  const sel = (withNew: boolean) =>
    `id, status, created_at, replied_at, message, reply${withNew ? ", last_message_at" : ""},
     activities ( id, name, center_id, centers ( id, name${withNew ? ", is_test_fixture" : ""} ) ),
     profiles!parent_id ( full_name )`;
  let res = await supabase.from("activity_inquiries").select(sel(true)).order("created_at", { ascending: false }).limit(3000);
  if (res.error?.code === "42703") res = await supabase.from("activity_inquiries").select(sel(false)).order("created_at", { ascending: false }).limit(3000);
  if (res.error || !res.data) return [];
  return (res.data as unknown as RawInquiry[]).map((r) => {
    const a = firstOf(r.activities);
    const c = firstOf(a?.centers ?? null);
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      repliedAt: r.replied_at,
      lastMessageAt: r.last_message_at ?? null,
      centerId: c?.id ?? a?.center_id ?? null,
      centerName: c?.name ?? "Centro",
      centerIsTestFixture: Boolean(c?.is_test_fixture),
      activityId: a?.id ?? null,
      activityName: a?.name ?? "Attività",
      parentName: firstOf(r.profiles)?.full_name || "Genitore",
      message: r.message ?? "",
      reply: r.reply,
    };
  });
}

// ── Attività e giornata ───────────────────────────────────────────────────

export interface AdminActivityInfo {
  id: string;
  slug: string;
  name: string;
  centerId: string | null;
  centerName: string;
  centerIsTestFixture: boolean;
  bookingMode: "week_only" | "day_only" | "mixed" | null;
  pricePerWeek: number | null;
}

export interface AdminActivityDay {
  id: string;
  date: string;
  isOpen: boolean;
  capacity: number;
  spotsLeft: number;
}

export interface AdminActivityWeek {
  id: string;
  label: string | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  spotsLeft: number;
}

export interface AdminGroupRequest {
  id: string;
  status: string;
  kidsCount: number;
  createdAt: string;
  respondedAt: string | null;
}

export interface AdminActivityLogEntry {
  action: string;
  createdAt: string;
  meta: unknown;
}

export interface AdminActivityDetail {
  activity: AdminActivityInfo;
  days: AdminActivityDay[];
  weeks: AdminActivityWeek[];
  bookings: AdminBookingRow[];
  groupRequests: AdminGroupRequest[];
  log: AdminActivityLogEntry[];
  /** Bambini per prenotazione (booking_kids), per il registro. */
  kidsByBooking: Record<string, number>;
}

export async function getAdminActivityDetail(activityId: string): Promise<AdminActivityDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(activityId)) return null;
  const supabase = await adminSession();
  if (!supabase) return null;

  let actRes = await supabase
    .from("activities")
    .select("id, slug, name, booking_mode, price_per_week, center_id, centers ( id, name, is_test_fixture )")
    .eq("id", activityId)
    .maybeSingle();
  if (actRes.error?.code === "42703") {
    actRes = await supabase
      .from("activities")
      .select("id, slug, name, booking_mode, price_per_week, center_id, centers ( id, name )")
      .eq("id", activityId)
      .maybeSingle();
  }
  const a = actRes.data as unknown as {
    id: string;
    slug: string;
    name: string;
    booking_mode: string | null;
    price_per_week: number | string | null;
    center_id: string | null;
    centers: RawCenter | RawCenter[] | null;
  } | null;
  if (!a) return null;
  const c = firstOf(a.centers);
  const mode = a.booking_mode;

  const [daysRes, weeksRes, bookings, groupsRes, logRes] = await Promise.all([
    supabase.from("activity_days").select("id, date, is_open, capacity, spots_left").eq("activity_id", activityId).order("date"),
    supabase.from("activity_weeks").select("id, label, start_date, end_date, capacity, spots_left").eq("activity_id", activityId).order("start_date"),
    getAdminBookings({ activityId, limit: 2000 }),
    supabase.from("group_requests").select("id, status, kids_count, created_at, responded_at").eq("activity_id", activityId).order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("action, created_at, meta")
      .eq("entity_id", activityId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const kidsByBooking: Record<string, number> = {};
  for (const b of bookings) kidsByBooking[b.id] = b.kidNames.length;

  return {
    activity: {
      id: a.id,
      slug: a.slug,
      name: a.name,
      centerId: c?.id ?? a.center_id,
      centerName: c?.name ?? "Centro",
      centerIsTestFixture: Boolean(c?.is_test_fixture),
      bookingMode: mode === "day_only" || mode === "mixed" || mode === "week_only" ? mode : null,
      pricePerWeek: a.price_per_week === null || a.price_per_week === undefined ? null : Number(a.price_per_week),
    },
    days: ((daysRes.data ?? []) as { id: string; date: string; is_open: boolean | null; capacity: number | null; spots_left: number | null }[]).map((d) => ({
      id: d.id,
      date: d.date,
      isOpen: d.is_open !== false,
      capacity: d.capacity ?? 0,
      spotsLeft: d.spots_left ?? 0,
    })),
    weeks: ((weeksRes.data ?? []) as { id: string; label: string | null; start_date: string; end_date: string | null; capacity: number | null; spots_left: number | null }[]).map((w) => ({
      id: w.id,
      label: w.label,
      startDate: w.start_date,
      endDate: w.end_date,
      capacity: w.capacity ?? 0,
      spotsLeft: w.spots_left ?? 0,
    })),
    bookings,
    groupRequests: ((groupsRes.data ?? []) as { id: string; status: string; kids_count: number | null; created_at: string; responded_at: string | null }[]).map((g) => ({
      id: g.id,
      status: g.status,
      kidsCount: g.kids_count ?? 0,
      createdAt: g.created_at,
      respondedAt: g.responded_at,
    })),
    log: ((logRes.data ?? []) as { action: string; created_at: string; meta: unknown }[]).map((l) => ({ action: l.action, createdAt: l.created_at, meta: l.meta })),
    kidsByBooking,
  };
}

// ── Famiglie: dalla richiesta alla registrazione ─────────────────────────

export interface AdminFamilyFunnelData {
  waitlist: { id: string; email: string; status: "nuovo" | "invitato" | "archiviato"; createdAt: string; invitedAt: string | null; comune: string | null; account: AccountRef | null }[];
  parents: { id: string; email: string | null; createdAt: string; betaCode: string | null }[];
  memberships: { userId: string; familyId: string }[];
  codes: { code: string; label: string | null; active: boolean; redeemedCount: number; maxRedemptions: number | null; expiresAt: string | null }[];
  excludedIds: string[];
  /** Componenti della coorte interna (account del founder e di prova). */
  internalIds: string[];
}

export async function getAdminFamilyFunnel(): Promise<AdminFamilyFunnelData | null> {
  const supabase = await adminSession();
  if (!supabase) return null;
  const [wl, prof, fm, codes, settings, cohort] = await Promise.all([
    supabase.from("beta_waitlist").select("id, email, status, created_at, invited_at, comune").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, email, created_at, beta_invited_by_code, role").eq("role", "parent").limit(5000),
    // Retest 12/11/2026: family_members non ha il bypass Admin nella RLS
    // (is_family_member): col client di sessione l'Admin vedeva solo la
    // propria famiglia e ogni altro genitore contava come famiglia a sé. Dopo
    // il controllo platform_admin qui sopra, come fa il cockpit, si legge col
    // client di servizio (sola lettura, solo id). Senza chiave: come prima.
    (createServiceClient() ?? supabase).from("family_members").select("family_id, parent_id").limit(10000),
    supabase.from("beta_invite_codes").select("code, label, active, redeemed_count, max_redemptions, expires_at").order("created_at", { ascending: false }),
    supabase.from("beta_cockpit_settings").select("excluded_user_ids").eq("id", 1).maybeSingle(),
    supabase.from("beta_cohort_memberships").select("user_id").eq("cohort_key", "internal-preview").eq("active", true),
  ]);
  type W = { id: string; email: string; status: "nuovo" | "invitato" | "archiviato"; created_at: string; invited_at: string | null; comune: string | null };
  // Lotto 2 (16/11/2026): stesso abbinamento account di Oggi e Lista d'attesa.
  const accounts = await findAccountsByEmail(supabase, ((wl.data ?? []) as W[]).map((w) => w.email));
  type P = { id: string; email: string | null; created_at: string; beta_invited_by_code: string | null };
  type C = { code: string; label: string | null; active: boolean; redeemed_count: number | null; max_redemptions: number | null; expires_at: string | null };
  return {
    waitlist: ((wl.data ?? []) as W[]).map((w) => ({
      id: w.id,
      email: w.email,
      status: w.status,
      createdAt: w.created_at,
      invitedAt: w.invited_at,
      comune: w.comune,
      account: accounts.get(w.email.trim().toLowerCase()) ?? null,
    })),
    parents: ((prof.data ?? []) as P[]).map((p) => ({ id: p.id, email: p.email, createdAt: p.created_at, betaCode: p.beta_invited_by_code })),
    memberships: ((fm.data ?? []) as { family_id: string; parent_id: string }[]).map((m) => ({ userId: m.parent_id, familyId: m.family_id })),
    codes: ((codes.data ?? []) as C[]).map((c) => ({
      code: c.code,
      label: c.label,
      active: Boolean(c.active),
      redeemedCount: c.redeemed_count ?? 0,
      maxRedemptions: c.max_redemptions,
      expiresAt: c.expires_at,
    })),
    excludedIds: ((settings.data as { excluded_user_ids?: string[] | null } | null)?.excluded_user_ids ?? []).filter(Boolean),
    internalIds: ((cohort.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
  };
}
