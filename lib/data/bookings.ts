// Riepilogo di una prenotazione appena creata, per la schermata di successo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface BookingSummary {
  kidNames: string;
  weeksLabel: string;
  shuttleIncluded: boolean;
  totalAmount: number;
}

interface RawBookingSummaryRow {
  total_amount: number | null;
  shuttle_included: boolean | null;
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
  booking_weeks: { activity_weeks: { label: string } | { label: string }[] | null }[] | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getBookingSummary(bookingId: string): Promise<BookingSummary | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "total_amount, shuttle_included, booking_kids ( kids ( name ) ), booking_weeks ( activity_weeks ( label ) )"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as RawBookingSummaryRow;

  const kidNames =
    (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids)?.name)
      .filter((n): n is string => Boolean(n))
      .join(", ") || "—";

  const weeksLabel =
    (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks)?.label)
      .filter((l): l is string => Boolean(l))
      .join(", ") || "—";

  return {
    kidNames,
    weeksLabel,
    shuttleIncluded: Boolean(row.shuttle_included),
    totalAmount: Number(row.total_amount ?? 0),
  };
}
