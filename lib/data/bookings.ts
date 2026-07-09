// Riepilogo di una prenotazione appena creata, per la schermata di successo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface BookingSummary {
  kidNames: string;
  weeksLabel: string; // esplicito: "Settimana 3 (8-12 lug), Settimana 4 (15-19 lug)"
  shuttleIncluded: boolean;
  totalAmount: number;
  startDate: string | null; // ISO, inizio della settimana piu antica -- per "Aggiungi al calendario"
  endDate: string | null; // ISO, fine della settimana piu recente
  activityName: string | null;
}

interface RawBookingSummaryRow {
  total_amount: number | null;
  shuttle_included: boolean | null;
  activities: { name: string } | { name: string }[] | null;
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
  booking_weeks:
    | {
        activity_weeks:
          | { label: string; start_date: string; end_date: string }
          | { label: string; start_date: string; end_date: string }[]
          | null;
      }[]
    | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

export async function getBookingSummary(bookingId: string): Promise<BookingSummary | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "total_amount, shuttle_included, activities ( name ), booking_kids ( kids ( name ) ), booking_weeks ( activity_weeks ( label, start_date, end_date ) )"
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

  const weekRows = (row.booking_weeks ?? [])
    .map((bw) => firstOf(bw.activity_weeks))
    .filter((w): w is { label: string; start_date: string; end_date: string } => Boolean(w))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const weeksLabel =
    weekRows
      .map((w) => `${w.label} (${formatDateShort(w.start_date)}–${formatDateShort(w.end_date)})`)
      .join(", ") || "—";

  const startDate = weekRows[0]?.start_date ?? null;
  const endDate = weekRows[weekRows.length - 1]?.end_date ?? null;

  return {
    kidNames,
    weeksLabel,
    shuttleIncluded: Boolean(row.shuttle_included),
    totalAmount: Number(row.total_amount ?? 0),
    startDate,
    endDate,
    activityName: firstOf(row.activities)?.name ?? null,
  };
}
