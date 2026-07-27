// TRAMA ONE Build Sprint 4 (DEC-42, ACR-007/ACR-022, vincolo P0 da V2) — KPI
// Admin sulle PRENOTAZIONI (non messaggistica, vedi lib/data/admin-inquiries.ts
// per quella): stesso principio esatto (SLA aggregata per centro, tempo
// medio di risposta, prenotazioni non ancora gestite), qui su
// public.bookings/partner_decision invece di activity_inquiries/status —
// entità diversa, stesso pattern letto in quel file (DEC-15: riuso di
// pattern, non di tabella).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface CenterBookingSla {
  centerId: string;
  centerName: string;
  centerEmoji: string;
  totalCount: number;
  pendingCount: number;
  avgResponseHours: number | null;
  oldestPendingDays: number | null;
}

export interface BookingsSlaOverview {
  centers: CenterBookingSla[];
  platformPendingCount: number;
  platformAvgResponseHours: number | null;
}

interface RawRow {
  status: string;
  partner_decision: "pending" | "accepted" | "rejected" | "proposed";
  created_at: string;
  responded_at: string | null;
  activities:
    | { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null }
    | { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null }[]
    | null;
}

export async function getBookingsSlaOverview(): Promise<BookingsSlaOverview> {
  const empty: BookingsSlaOverview = { centers: [], platformPendingCount: 0, platformAvgResponseHours: null };
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("status, partner_decision, created_at, responded_at, activities ( center_id, centers ( name, emoji ) )")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error || !data) return empty;

  const now = Date.now();
  interface Acc {
    centerName: string;
    centerEmoji: string;
    totalCount: number;
    pendingCount: number;
    responseHoursSum: number;
    responseCount: number;
    oldestPendingMs: number | null;
  }
  const map = new Map<string, Acc>();

  for (const row of data as unknown as RawRow[]) {
    const activity = firstOf(row.activities);
    const centerId = activity?.center_id;
    if (!centerId) continue;
    const center = firstOf(activity?.centers);

    const existing = map.get(centerId) ?? {
      centerName: center?.name || "Centro",
      centerEmoji: center?.emoji || "🏫",
      totalCount: 0,
      pendingCount: 0,
      responseHoursSum: 0,
      responseCount: 0,
      oldestPendingMs: null as number | null,
    };

    existing.totalCount += 1;
    const createdMs = new Date(row.created_at).getTime();

    if (row.partner_decision === "pending") {
      existing.pendingCount += 1;
      const ageMs = now - createdMs;
      if (existing.oldestPendingMs === null || ageMs > existing.oldestPendingMs) existing.oldestPendingMs = ageMs;
    } else if (row.responded_at) {
      const responseMs = new Date(row.responded_at).getTime() - createdMs;
      if (responseMs >= 0) {
        existing.responseHoursSum += responseMs / (1000 * 60 * 60);
        existing.responseCount += 1;
      }
    }

    map.set(centerId, existing);
  }

  const centers: CenterBookingSla[] = Array.from(map.entries())
    .map(([centerId, acc]) => ({
      centerId,
      centerName: acc.centerName,
      centerEmoji: acc.centerEmoji,
      totalCount: acc.totalCount,
      pendingCount: acc.pendingCount,
      avgResponseHours: acc.responseCount > 0 ? acc.responseHoursSum / acc.responseCount : null,
      oldestPendingDays: acc.oldestPendingMs !== null ? acc.oldestPendingMs / (1000 * 60 * 60 * 24) : null,
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount || b.totalCount - a.totalCount);

  const platformPendingCount = centers.reduce((sum, c) => sum + c.pendingCount, 0);
  const responseSamples = centers.filter((c) => c.avgResponseHours !== null);
  const platformAvgResponseHours =
    responseSamples.length > 0
      ? responseSamples.reduce((sum, c) => sum + (c.avgResponseHours ?? 0), 0) / responseSamples.length
      : null;

  return { centers, platformPendingCount, platformAvgResponseHours };
}
