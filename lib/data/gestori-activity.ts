// KPI Admin: quanto e come intervengono i Gestori centro (letto dalla
// tabella activity_log, popolata dalle azioni in app/actions/center.ts e
// app/actions/tags.ts). Vuoto finché non è stata eseguita
// supabase/migration_05_activity_log.sql e i gestori non hanno ancora fatto
// modifiche.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface GestoreActivitySummary {
  centerId: string;
  centerName: string;
  centerEmoji: string;
  totalActions: number;
  pricingActions: number;
  lastActionAt: string | null;
}

interface RawLogRow {
  center_id: string | null;
  action: string;
  meta: unknown;
  created_at: string;
  centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null;
}

export async function getGestoriActivitySummary(): Promise<GestoreActivitySummary[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("center_id, action, meta, created_at, centers ( name, emoji )")
    .order("created_at", { ascending: false })
    .limit(2000);

  // Tabella non ancora creata (migrazione non eseguita) o nessun dato.
  if (error || !data) return [];

  const map = new Map<string, GestoreActivitySummary>();

  for (const row of data as unknown as RawLogRow[]) {
    if (!row.center_id) continue;
    const center = firstOf(row.centers);
    const existing = map.get(row.center_id) ?? {
      centerId: row.center_id,
      centerName: center?.name || "Centro",
      centerEmoji: center?.emoji || "🏫",
      totalActions: 0,
      pricingActions: 0,
      lastActionAt: null as string | null,
    };

    existing.totalActions += 1;

    const meta = row.meta as { priceChanged?: boolean } | null;
    const isPricingEdit =
      row.action === "promotion_create" ||
      row.action === "promotion_delete" ||
      (row.action === "activity_update" && meta?.priceChanged === true);
    if (isPricingEdit) existing.pricingActions += 1;

    if (!existing.lastActionAt || row.created_at > existing.lastActionAt) {
      existing.lastActionAt = row.created_at;
    }

    map.set(row.center_id, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.totalActions - a.totalActions);
}
