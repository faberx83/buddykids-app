// 04/11/2026 (decisione di Fabrizio sulla conferma parziale): dopo una
// risposta del centro sui giorni di una prenotazione,
//   1. riallinea l'importo salvato ai giorni non rifiutati (stessa cifra nel
//      portale centri e per la famiglia), con la regola comune;
//   2. manda UNA email chiara alla famiglia: giorni confermati, non
//      accettati, in attesa, e importo.
// Modulo separato dalle server action per lo stesso motivo di
// apply-day-decision.ts (testabilità). Logica pura in
// lib/booking-response/day-decisions-message.ts.

import { createClient } from "@/lib/supabase/server";
import { buildFamilyTiers } from "@/lib/family-discount";
import { amountsAfterDecisions, dayDecisionsMessage, type DayDecision, type DecidedDay } from "./day-decisions-message";
import { notifyParentWithMessage } from "./notify";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function finalizeDayDecisions(
  supabase: SupabaseClientLike,
  bookingId: string,
  opts: { notify: boolean }
): Promise<{ totalAmount: number; discountAmount: number } | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "parent_id, status, total_amount, discount_amount, activities ( name, centers ( family_discount_tiers ) ), booking_kids ( kid_id ), booking_days ( price, partner_decision, activity_days ( date ) )"
    )
    .eq("id", bookingId)
    .single();
  if (error || !data) return null;

  const row = data as unknown as {
    parent_id: string | null;
    status: string;
    total_amount: number;
    discount_amount: number | null;
    activities: { name: string; centers: { family_discount_tiers: number[] | null } | { family_discount_tiers: number[] | null }[] | null } | null;
    booking_kids: { kid_id: string }[] | null;
    booking_days: { price: number; partner_decision: string; activity_days: { date: string } | { date: string }[] | null }[] | null;
  };
  const activity = firstOf(row.activities as never) as { name: string; centers: unknown } | null;
  const center = activity ? (firstOf(activity.centers as never) as { family_discount_tiers: number[] | null } | null) : null;
  const days: DecidedDay[] = (row.booking_days ?? [])
    .map((d) => ({
      date: firstOf(d.activity_days)?.date ?? "",
      price: Number(d.price) || 0,
      decision: (["accepted", "rejected", "waitlisted"].includes(d.partner_decision) ? d.partner_decision : "pending") as DayDecision,
    }))
    .filter((d) => d.date);
  if (days.length === 0) return null;

  const previous = { totalAmount: Number(row.total_amount) || 0, discountAmount: Number(row.discount_amount) || 0 };
  const next = amountsAfterDecisions({
    previous,
    days,
    kidsCount: (row.booking_kids ?? []).length,
    familyTiers: buildFamilyTiers(center?.family_discount_tiers ?? null),
  });
  if (next.totalAmount !== previous.totalAmount || next.discountAmount !== previous.discountAmount) {
    await supabase.from("bookings").update({ total_amount: next.totalAmount, discount_amount: next.discountAmount }).eq("id", bookingId);
  }

  if (opts.notify && row.status !== "cancelled") {
    await notifyParentWithMessage(supabase, bookingId, row.parent_id, (firstName) =>
      dayDecisionsMessage({
        firstName,
        activityName: activity?.name ?? "la tua prenotazione",
        days,
        totalAmount: next.totalAmount,
        previousTotal: previous.totalAmount,
      })
    );
  }
  return next;
}
