// SPRINT 5.3 (NEXTGEN) — "Condivisione Piano": link pubblico di sola lettura
// per un periodo (settimana o mese), per chi non ha un account (nonni, tata,
// altri genitori) — vedi supabase/schema.sql per la tabella plan_shares e le
// funzioni pubbliche get_shared_plan()/get_shared_plan_meta() (security
// definer, restituiscono SOLO campi non sensibili: mai importi/indirizzi/
// contatti). Stesso pattern già usato per get_invite_preview() (inviti).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface PlanShare {
  id: string;
  token: string;
  label: string | null;
  scopeStart: string;
  scopeEnd: string;
  createdAt: string;
  revokedAt: string | null;
}

interface RawPlanShareRow {
  id: string;
  token: string;
  label: string | null;
  scope_start: string;
  scope_end: string;
  created_at: string;
  revoked_at: string | null;
}

// Elenco dei link creati dal genitore loggato (per gestirli/revocarli) — MAI
// usato dalla pagina pubblica, che passa sempre dalle funzioni RPC qui sotto.
export async function getPlanSharesForParent(): Promise<PlanShare[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("plan_shares")
    .select("id, token, label, scope_start, scope_end, created_at, revoked_at")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as RawPlanShareRow[]).map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    scopeStart: r.scope_start,
    scopeEnd: r.scope_end,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export interface SharedPlanMeta {
  label: string | null;
  scopeStart: string;
  scopeEnd: string;
  valid: boolean;
}

// Usata dalla pagina pubblica (nessun login) — passa dalla funzione RPC
// get_shared_plan_meta (security definer), non legge mai plan_shares
// direttamente: la tabella resta privata al genitore proprietario.
export async function getSharedPlanMeta(token: string): Promise<SharedPlanMeta | null> {
  if (!isSupabaseConfigured || !token) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_plan_meta", { p_token: token }).maybeSingle();
  if (error || !data) return null;

  const row = data as { label: string | null; scope_start: string; scope_end: string; valid: boolean };
  return {
    label: row.label,
    scopeStart: row.scope_start,
    scopeEnd: row.scope_end,
    valid: Boolean(row.valid),
  };
}

export interface SharedPlanEntry {
  kidName: string;
  activityName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
}

interface RawSharedPlanRow {
  kid_name: string;
  activity_name: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
}

// Contenuto pubblico: SOLO nome bambino, attività, date, stato — mai importi/
// indirizzi/contatti (vedi get_shared_plan() in schema.sql).
export async function getSharedPlanEntries(token: string): Promise<SharedPlanEntry[]> {
  if (!isSupabaseConfigured || !token) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_plan", { p_token: token });
  if (error || !data) return [];

  return (data as RawSharedPlanRow[]).map((r) => ({
    kidName: r.kid_name,
    activityName: r.activity_name,
    weekStartDate: r.week_start_date,
    weekEndDate: r.week_end_date,
    status: r.status,
  }));
}
