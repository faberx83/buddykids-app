// Codici invito Beta — lettura Admin (public.beta_invite_codes,
// migration_30_beta_invite_codes.sql). Stesso principio di
// lib/data/feature-flag-overrides.ts: RLS già impone is_platform_admin() su
// insert/update/delete/SELECT, quindi qui si usa il client autenticato
// ordinario (mai il service client) — chi chiama senza essere Admin riceve
// semplicemente 0 righe.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { computeBetaInviteCodeState, BetaInviteCodeState } from "@/lib/beta-invites/eligibility";

export interface BetaInviteCodeRow {
  id: string;
  code: string;
  cohortKey: string;
  label: string | null;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  state: BetaInviteCodeState;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string | null;
  updatedByEmail: string | null;
}

interface RawBetaInviteCodeRow {
  id: string;
  code: string;
  cohort_key: string;
  label: string | null;
  active: boolean;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/** Legge tutti i codici invito Beta per la pagina /admin/beta-invites. */
export async function getBetaInviteCodesForAdmin(): Promise<BetaInviteCodeRow[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_invite_codes")
    .select("id, code, cohort_key, label, active, max_redemptions, redeemed_count, expires_at, created_at, updated_at, created_by, updated_by")
    .order("created_at", { ascending: false });

  const rows: RawBetaInviteCodeRow[] = error || !data ? [] : data;

  const profileIds = Array.from(
    new Set(rows.flatMap((r) => [r.created_by, r.updated_by]).filter((v): v is string => Boolean(v)))
  );
  const emailById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", profileIds);
    for (const p of profiles ?? []) {
      if (p.email) emailById.set(p.id, p.email);
    }
  }

  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    cohortKey: row.cohort_key,
    label: row.label,
    active: row.active,
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at,
    state: computeBetaInviteCodeState(
      { active: row.active, expiresAt: row.expires_at, maxRedemptions: row.max_redemptions, redeemedCount: row.redeemed_count },
      now
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByEmail: row.created_by ? (emailById.get(row.created_by) ?? null) : null,
    updatedByEmail: row.updated_by ? (emailById.get(row.updated_by) ?? null) : null,
  }));
}
