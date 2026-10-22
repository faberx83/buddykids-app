// Tag master della piattaforma (tabella tags) — lettura pubblica, scrittura
// riservata all'Admin piattaforma (RLS già impostata in schema.sql).

import { Tag } from "@/lib/types";
import { categories as mockTags } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RawTagRow {
  id: string;
  label: string;
  emoji: string | null;
  bg_color: string | null;
  /** Migration 50 (22/10/2026). Assente finché non è applicata. */
  is_test_fixture?: boolean | null;
}

export async function getTags(): Promise<Tag[]> {
  if (!isSupabaseConfigured) return mockTags;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    // "*" e non l'elenco delle colonne: prima della migration 50
    // is_test_fixture non esiste, e chiederla per nome darebbe errore.
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return mockTags;

  return (data as RawTagRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    emoji: row.emoji || "🏷️",
    bg: row.bg_color || "#E3F9F5",
    ...(row.is_test_fixture ? { isTestFixture: true } : {}),
  }));
}
