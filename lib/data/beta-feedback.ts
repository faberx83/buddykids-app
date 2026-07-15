// SPRINT 5 (NEXTGEN) — "Segnala un problema": data layer per la floating CTA
// genitore, la sezione "temporanea" Profilo > Le mie segnalazioni, e la coda
// Admin /admin/segnalazioni-beta. Vedi supabase/schema.sql#beta_feedback per
// schema e RLS (che fanno già il filtraggio: un genitore vede solo le
// proprie righe, solo un platform_admin vede tutte).
//
// Tipi e la funzione pura computeBetaFeedbackCounts vivono in
// lib/nextgen/beta-feedback-shared.ts (nessun import server-only, vedi
// commento lì) — qui ri-esportati per non rompere chi già importava da
// questo file lato server.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { BetaFeedbackItem, BetaFeedbackSource, BetaFeedbackStatus } from "@/lib/nextgen/beta-feedback-shared";
export type { BetaFeedbackItem, BetaFeedbackSource, BetaFeedbackStatus, BetaFeedbackCounts } from "@/lib/nextgen/beta-feedback-shared";
export { computeBetaFeedbackCounts } from "@/lib/nextgen/beta-feedback-shared";

interface RawRow {
  id: string;
  app_source: BetaFeedbackSource;
  area: string;
  page_path: string;
  message: string;
  status: BetaFeedbackStatus;
  admin_note: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapRow(row: RawRow): BetaFeedbackItem {
  return {
    id: row.id,
    appSource: row.app_source,
    area: row.area,
    pagePath: row.page_path,
    message: row.message,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    createdAt: row.created_at,
    parentName: firstOf(row.profiles)?.full_name ?? undefined,
  };
}

// Le proprie segnalazioni — usata dalla sezione "temporanea" Profilo > Le
// mie segnalazioni, per seguire l'esito di quanto inviato durante la BETA.
export async function getMyBetaFeedback(): Promise<BetaFeedbackItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("beta_feedback")
    .select("id, app_source, area, page_path, message, status, admin_note, created_at")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawRow[]).map(mapRow);
}

// Tutte le segnalazioni (qualunque app_source/stato) — usata dalla coda
// Admin. Le RLS lasciano passare tutte le righe solo se davvero
// platform_admin.
export async function getAllBetaFeedbackForAdmin(): Promise<BetaFeedbackItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_feedback")
    .select("id, app_source, area, page_path, message, status, admin_note, created_at, profiles ( full_name )")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawRow[]).map(mapRow);
}
