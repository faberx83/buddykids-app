// TRAMA ONE Build Sprint 6 (backlog vincolante P1, "Feature flag override
// expiry") — visibilità Admin sugli override di public.feature_flag_overrides
// (schema/RLS in supabase/migration_07_feature_flags_foundation.sql). Prima
// di questo file l'unico modo di ispezionare/gestire un override era una
// query SQL manuale (SPRINT_0_ACTIVATION_RUNBOOK.md) — che è esattamente
// come un override di TRAMA_ONE_ENABLED è scaduto senza che nessuno se ne
// accorgesse (causa radice di TC-N409, Gate C ottava ondata).
//
// Nota RLS: le 4 policy su feature_flag_overrides (select/insert/update/
// delete) richiedono già is_platform_admin() — questo modulo usa il client
// autenticato ordinario (lib/supabase/server.ts), NON il service client di
// lib/supabase/service.ts: chi chiama con un profilo non-Admin riceve
// semplicemente 0 righe (select) o un errore Postgres (write), stesso
// principio già in uso in app/actions/admin.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { FEATURE_FLAG_REGISTRY, FeatureFlagScope, KnownFeatureFlagName } from "@/lib/feature-flags/registry";

export type FeatureFlagOverrideStatus = "active" | "expiring_soon" | "expired" | "no_expiry";

// Stessa finestra di "grazia" usata lato resolver (lib/feature-flags/
// evaluate.ts, SILENT_FALLBACK_GRACE_MS) per l'allarme "scaduto di recente"
// — qui riusata per la soglia "in scadenza" (72h PRIMA della scadenza,
// invece che dopo): stesso ordine di grandezza, stesso obiettivo (dare il
// tempo a un Admin di accorgersene prima che diventi un incidente silenzioso).
const EXPIRING_SOON_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h

export function computeOverrideStatus(
  expiresAt: string | null,
  now: Date = new Date()
): FeatureFlagOverrideStatus {
  if (!expiresAt) return "no_expiry";
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) return "expired"; // stessa scelta fail-safe di evaluate.ts::isExpired
  const diffMs = parsed - now.getTime();
  if (diffMs <= 0) return "expired";
  if (diffMs <= EXPIRING_SOON_WINDOW_MS) return "expiring_soon";
  return "active";
}

export interface FeatureFlagOverrideRow {
  id: string;
  flagName: string;
  scopeType: FeatureFlagScope;
  scopeValue: string | null;
  enabled: boolean;
  expiresAt: string | null;
  status: FeatureFlagOverrideStatus;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string | null;
  updatedByEmail: string | null;
}

export interface FeatureFlagAdminEntry {
  flagName: KnownFeatureFlagName;
  description: string;
  defaultValue: boolean;
  allowedScopes: FeatureFlagScope[];
  overrides: FeatureFlagOverrideRow[];
  /** true se almeno un override di questo flag è "expiring_soon" o "expired" con enabled=true — usato per il badge di allarme in UI. */
  hasAlert: boolean;
}

interface RawOverrideRow {
  id: string;
  flag_name: string;
  scope_type: string;
  scope_value: string | null;
  enabled: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/** Legge TUTTI gli override di TUTTI i flag noti al registry, arricchiti con lo stato calcolato — per la pagina /admin/feature-flags. */
export async function getFeatureFlagOverridesForAdmin(): Promise<FeatureFlagAdminEntry[]> {
  const flagNames = Object.keys(FEATURE_FLAG_REGISTRY) as KnownFeatureFlagName[];
  if (!isSupabaseConfigured) {
    return flagNames.map((flagName) => ({
      flagName,
      description: FEATURE_FLAG_REGISTRY[flagName].description,
      defaultValue: FEATURE_FLAG_REGISTRY[flagName].defaultValue,
      allowedScopes: [...FEATURE_FLAG_REGISTRY[flagName].allowedScopes],
      overrides: [],
      hasAlert: false,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flag_overrides")
    .select("id, flag_name, scope_type, scope_value, enabled, expires_at, created_at, updated_at, created_by, updated_by")
    .order("flag_name", { ascending: true })
    .order("created_at", { ascending: false });

  const rows: RawOverrideRow[] = error || !data ? [] : data;

  // Risoluzione email created_by/updated_by in un'unica query aggiuntiva
  // (stesso pattern "raccogli gli id, una select in più" già usato altrove
  // nel repository, es. lib/data/center-leads.ts).
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
  const byFlag = new Map<string, FeatureFlagOverrideRow[]>();
  for (const row of rows) {
    const status = computeOverrideStatus(row.expires_at, now);
    const mapped: FeatureFlagOverrideRow = {
      id: row.id,
      flagName: row.flag_name,
      scopeType: row.scope_type as FeatureFlagScope,
      scopeValue: row.scope_value,
      enabled: row.enabled,
      expiresAt: row.expires_at,
      status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByEmail: row.created_by ? (emailById.get(row.created_by) ?? null) : null,
      updatedByEmail: row.updated_by ? (emailById.get(row.updated_by) ?? null) : null,
    };
    const list = byFlag.get(row.flag_name) ?? [];
    list.push(mapped);
    byFlag.set(row.flag_name, list);
  }

  return flagNames.map((flagName) => {
    const overrides = byFlag.get(flagName) ?? [];
    const hasAlert = overrides.some((o) => o.enabled && (o.status === "expiring_soon" || o.status === "expired"));
    return {
      flagName,
      description: FEATURE_FLAG_REGISTRY[flagName].description,
      defaultValue: FEATURE_FLAG_REGISTRY[flagName].defaultValue,
      allowedScopes: [...FEATURE_FLAG_REGISTRY[flagName].allowedScopes],
      overrides,
      hasAlert,
    };
  });
}
