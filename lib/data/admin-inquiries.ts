// KPI Admin: pannello SLA sulle Richieste genitore→gestore ("Contatta il
// gestore", vedi lib/data/inquiries.ts) — qui aggregato su TUTTI i centri,
// non su un singolo centro come /center/richieste. Proposto a Fabrizio per
// capire quali centri rispondono poco/lentamente ai genitori.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface CenterInquirySla {
  centerId: string;
  centerName: string;
  centerEmoji: string;
  totalCount: number;
  openCount: number;
  // Ore medie tra creazione e risposta, solo sulle richieste già risposte —
  // null se il centro non ha ancora risposto a nessuna.
  avgResponseHours: number | null;
  // Età (in giorni) della richiesta APERTA più vecchia — null se non ce ne
  // sono di aperte.
  oldestOpenDays: number | null;
}

export interface InquiriesSlaOverview {
  centers: CenterInquirySla[];
  platformOpenCount: number;
  platformAvgResponseHours: number | null;
}

interface RawRow {
  status: "aperta" | "risposta" | "chiusa";
  created_at: string;
  replied_at: string | null;
  activities: { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null } | { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null }[] | null;
}

export async function getInquiriesSlaOverview(): Promise<InquiriesSlaOverview> {
  const empty: InquiriesSlaOverview = { centers: [], platformOpenCount: 0, platformAvgResponseHours: null };
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_inquiries")
    .select("status, created_at, replied_at, activities ( center_id, centers ( name, emoji ) )")
    .order("created_at", { ascending: false })
    .limit(3000);

  // Tabella non ancora creata (migrazione non eseguita) o nessun dato.
  if (error || !data) return empty;

  const now = Date.now();
  interface Acc {
    centerName: string;
    centerEmoji: string;
    totalCount: number;
    openCount: number;
    responseHoursSum: number;
    responseCount: number;
    oldestOpenMs: number | null;
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
      openCount: 0,
      responseHoursSum: 0,
      responseCount: 0,
      oldestOpenMs: null as number | null,
    };

    existing.totalCount += 1;
    const createdMs = new Date(row.created_at).getTime();

    if (row.status === "aperta") {
      existing.openCount += 1;
      const ageMs = now - createdMs;
      if (existing.oldestOpenMs === null || ageMs > existing.oldestOpenMs) existing.oldestOpenMs = ageMs;
    } else if (row.replied_at) {
      const responseMs = new Date(row.replied_at).getTime() - createdMs;
      if (responseMs >= 0) {
        existing.responseHoursSum += responseMs / (1000 * 60 * 60);
        existing.responseCount += 1;
      }
    }

    map.set(centerId, existing);
  }

  const centers: CenterInquirySla[] = Array.from(map.entries())
    .map(([centerId, acc]) => ({
      centerId,
      centerName: acc.centerName,
      centerEmoji: acc.centerEmoji,
      totalCount: acc.totalCount,
      openCount: acc.openCount,
      avgResponseHours: acc.responseCount > 0 ? acc.responseHoursSum / acc.responseCount : null,
      oldestOpenDays: acc.oldestOpenMs !== null ? acc.oldestOpenMs / (1000 * 60 * 60 * 24) : null,
    }))
    // Prima i centri con più richieste aperte (i più urgenti da controllare).
    .sort((a, b) => b.openCount - a.openCount || b.totalCount - a.totalCount);

  const platformOpenCount = centers.reduce((sum, c) => sum + c.openCount, 0);
  const responseSamples = centers.filter((c) => c.avgResponseHours !== null);
  const platformAvgResponseHours =
    responseSamples.length > 0
      ? responseSamples.reduce((sum, c) => sum + (c.avgResponseHours ?? 0), 0) / responseSamples.length
      : null;

  return { centers, platformOpenCount, platformAvgResponseHours };
}
