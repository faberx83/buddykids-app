// "Le mie prenotazioni" (richiesta da Fabrizio per la v1): elenco reale,
// sola lettura, delle prenotazioni del genitore — attività, settimane,
// bambini, importo e stato. Nessuna cancellazione/modifica per ora (scope
// concordato: prima la lista, poi eventuali azioni).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface MyBooking {
  id: string;
  activityId: string; // slug, per il link alla scheda attività
  activityName: string;
  coverImageUrl: string | null;
  emoji: string;
  imgGradient: string;
  weeksLabel: string;
  kidNames: string[];
  status: BookingStatus;
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

interface RawActivityRef {
  slug: string;
  name: string;
  cover_image_url: string | null;
  emoji: string | null;
  img_gradient: string | null;
}

interface RawWeekRef {
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
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
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
      "id, status, total_amount, discount_amount, created_at, activities ( slug, name, cover_image_url, emoji, img_gradient ), booking_weeks ( activity_weeks ( label, start_date, end_date ) ), booking_kids ( kids ( name ) )"
    )
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as RawRow[]).map((row) => {
    const activity = firstOf(row.activities);
    const weekRows = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is RawWeekRef => Boolean(w))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const weeksLabel =
      weekRows.map((w) => `${w.label} (${formatDateShort(w.start_date)}–${formatDateShort(w.end_date)})`).join(", ") ||
      "—";
    const kidNames = (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids)?.name)
      .filter((n): n is string => Boolean(n));

    return {
      id: row.id,
      activityId: activity?.slug ?? "",
      activityName: activity?.name ?? "Attività",
      coverImageUrl: activity?.cover_image_url ?? null,
      emoji: activity?.emoji || "🏫",
      imgGradient: activity?.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
      weeksLabel,
      kidNames,
      status: row.status,
      totalAmount: row.total_amount,
      discountAmount: row.discount_amount,
      createdAt: row.created_at,
    };
  });
}
