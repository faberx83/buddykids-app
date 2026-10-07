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
import {
  BetaFeedbackItem,
  BetaFeedbackSource,
  BetaFeedbackStatus,
  isBetaFeedbackCategory,
  isMissingColumnError,
} from "@/lib/nextgen/beta-feedback-shared";
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
  pipeline_status: "none" | "confirmed" | "in_progress" | "done";
  // Migration 40 (family-first beta pass): assenti finché non è applicata.
  category?: string | null;
  client_context?: Record<string, unknown> | null;
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
    pipelineStatus: row.pipeline_status,
    category: isBetaFeedbackCategory(row.category) ? row.category : null,
    clientContext: row.client_context ?? null,
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
    .select("id, app_source, area, page_path, message, status, admin_note, created_at, pipeline_status")
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
  const baseColumns = "id, app_source, area, page_path, message, status, admin_note, created_at, pipeline_status, profiles ( full_name )";
  const attempt = await supabase
    .from("beta_feedback")
    .select(`${baseColumns}, category, client_context`)
    .order("created_at", { ascending: false });
  let data = attempt.data as RawRow[] | null;
  let error = attempt.error;

  // Migration 40 non ancora applicata: stessa lista di prima, senza categoria.
  if (error && isMissingColumnError(error)) {
    const fallback = await supabase.from("beta_feedback").select(baseColumns).order("created_at", { ascending: false });
    data = fallback.data as RawRow[] | null;
    error = fallback.error;
  }

  if (error || !data) return [];
  return data.map(mapRow);
}
