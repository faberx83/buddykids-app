"use server";

// TRAMA — Feature flag: azioni in blocco (13/11/2026).
// Richiesta di Fabrizio: "Se lo stato cambia fra anteprima e conferma, chiedi
// di rivedere l'anteprima. Registra l'operazione nello storico. Evita
// applicazioni parziali silenziose: se l'operazione non è atomica, mostra
// esito per flag e come recuperare."
// Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md (Project).
//
// Riuso:
//   - lettura: getFeatureFlagOverridesForAdmin (REUSE) + adminSession (REUSE,
//     controllo platform_admin come le altre pagine Admin);
//   - calcolo: computeBulkPreview (lib/flag-admin/bulk.ts), lo stesso usato
//     dall'anteprima in pagina;
//   - storico: activity_log (migration_05, già in produzione; RLS consente
//     l'inserimento all'admin), riga con center_id null così i KPI Gestori
//     (lib/data/gestori-activity.ts) la ignorano. Nessuna tabella nuova.
// Atomicità: Supabase JS non apre transazioni. Ogni scrittura è condizionata
// a updated_at letto in anteprima; se una fallisce, le precedenti vengono
// riportate indietro e l'esito torna flag per flag con le istruzioni di
// recupero. L'RPC transazionale è prevista col secondo incremento
// (pacchetti salvati), che richiede comunque una migration.

import { revalidatePath } from "next/cache";
import { adminSession } from "@/lib/data/admin-ops";
import { getFeatureFlagOverridesForAdmin } from "@/lib/data/feature-flag-overrides";
import { toBulkInputs } from "@/lib/flag-admin/inputs";
import {
  computeBulkPreview,
  inverseWrite,
  isBulkAction,
  isBulkAudience,
  recoveryHint,
  type BulkAction,
  type BulkAudience,
  type BulkPreview,
  type BulkWrite,
  type BulkWriteOutcome,
} from "@/lib/flag-admin/bulk";

type Db = NonNullable<Awaited<ReturnType<typeof adminSession>>>;

export interface FlagBulkPreviewResult {
  error?: string;
  preview?: BulkPreview;
}

export interface FlagBulkApplyResult {
  error?: string;
  /** L'anteprima non corrisponde più ai dati: va rivista prima di confermare. */
  stale?: boolean;
  preview?: BulkPreview;
  outcomes?: BulkWriteOutcome[];
  /** true se tutte le scritture sono andate a buon fine. */
  complete?: boolean;
  recovery?: string[];
  historyLogged?: boolean;
}

const MAX_FLAGS = 60;

async function load(flagNames: string[], audience: BulkAudience, action: BulkAction): Promise<BulkPreview | { error: string }> {
  const unique = Array.from(new Set(flagNames));
  if (unique.length === 0) return { error: "Seleziona almeno un flag." };
  if (unique.length > MAX_FLAGS) return { error: `Troppi flag selezionati (massimo ${MAX_FLAGS}).` };
  const entries = await getFeatureFlagOverridesForAdmin();
  const known = new Set(entries.map((e) => e.flagName as string));
  const missing = unique.filter((n) => !known.has(n));
  if (missing.length > 0) return { error: `Flag sconosciuti: ${missing.join(", ")}.` };
  const inputs = toBulkInputs(entries.filter((e) => unique.includes(e.flagName)));
  return computeBulkPreview(inputs, audience, action);
}

function validate(audience: unknown, action: unknown): string | null {
  // "Tutti" resta solo sui controlli singoli nel primo rilascio.
  if (!isBulkAudience(audience)) return "Pubblico non valido: in blocco si lavora solo su Anteprima interna o Pilot.";
  if (!isBulkAction(action)) return "Azione non valida.";
  return null;
}

export async function previewFlagBulkAction(flagNames: string[], audience: BulkAudience, action: BulkAction): Promise<FlagBulkPreviewResult> {
  const invalid = validate(audience, action);
  if (invalid) return { error: invalid };
  const db = await adminSession();
  if (!db) return { error: "Serve un account Admin." };
  const res = await load(flagNames, audience, action);
  if ("error" in res) return { error: res.error };
  return { preview: res };
}

async function runWrite(db: Db, actorId: string, w: BulkWrite, checkFresh: boolean): Promise<{ ok: boolean; error?: string; insertedId?: string }> {
  if (w.kind === "insert") {
    const { data, error } = await db
      .from("feature_flag_overrides")
      .insert({
        flag_name: w.flagName,
        scope_type: "cohort",
        scope_value: w.scopeValue,
        enabled: w.after!.enabled,
        expires_at: w.after!.expiresAt,
        created_by: actorId,
        updated_by: actorId,
      })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.code === "23505" ? "Nel frattempo è stata creata la stessa regola." : error.message };
    return { ok: true, insertedId: data?.id };
  }
  if (w.kind === "update") {
    let q = db
      .from("feature_flag_overrides")
      .update({ enabled: w.after!.enabled, expires_at: w.after!.expiresAt, updated_by: actorId })
      .eq("id", w.overrideId!);
    if (checkFresh && w.expectedUpdatedAt) q = q.eq("updated_at", w.expectedUpdatedAt);
    const { data, error } = await q.select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "La regola è cambiata nel frattempo." };
    return { ok: true };
  }
  let q = db.from("feature_flag_overrides").delete().eq("id", w.overrideId!);
  if (checkFresh && w.expectedUpdatedAt) q = q.eq("updated_at", w.expectedUpdatedAt);
  const { data, error } = await q.select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "La regola è cambiata nel frattempo." };
  return { ok: true };
}

export async function applyFlagBulkAction(
  flagNames: string[],
  audience: BulkAudience,
  action: BulkAction,
  previewFingerprint: string
): Promise<FlagBulkApplyResult> {
  const invalid = validate(audience, action);
  if (invalid) return { error: invalid };
  const db = await adminSession();
  if (!db) return { error: "Serve un account Admin." };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Non autenticato." };

  const fresh = await load(flagNames, audience, action);
  if ("error" in fresh) return { error: fresh.error };
  if (fresh.fingerprint !== previewFingerprint) {
    return { stale: true, preview: fresh };
  }
  if (fresh.writes.length === 0) {
    return { outcomes: [], complete: true, preview: fresh, historyLogged: false };
  }

  const outcomes: BulkWriteOutcome[] = [];
  const done: { write: BulkWrite; insertedId?: string }[] = [];
  let failedAt = -1;
  for (let i = 0; i < fresh.writes.length; i++) {
    const w = fresh.writes[i];
    const r = await runWrite(db, user.id, w, true);
    if (!r.ok) {
      outcomes.push({ flagName: w.flagName, ok: false, error: r.error });
      failedAt = i;
      break;
    }
    done.push({ write: w, insertedId: r.insertedId });
    outcomes.push({ flagName: w.flagName, ok: true });
  }

  const recovery: string[] = [];
  if (failedAt >= 0) {
    // Rientro: riporto indietro quanto già scritto, in ordine inverso.
    for (const d of [...done].reverse()) {
      const inv = inverseWrite(d.insertedId ? { ...d.write, overrideId: d.insertedId } : d.write);
      const r = await runWrite(db, user.id, inv, false);
      const o = outcomes.find((x) => x.flagName === d.write.flagName && x.ok);
      if (o) {
        o.ok = false;
        o.rolledBack = r.ok;
        o.error = r.ok ? "Annullata perché un'altra scrittura non è riuscita." : `Annullamento non riuscito: ${r.error}`;
      }
      if (!r.ok) recovery.push(recoveryHint(d.write));
    }
    for (const w of fresh.writes.slice(failedAt + 1)) {
      outcomes.push({ flagName: w.flagName, ok: false, error: "Non applicata: operazione interrotta." });
    }
  }

  const complete = failedAt < 0;
  let historyLogged = false;
  try {
    const { error } = await db.from("activity_log").insert({
      actor_id: user.id,
      center_id: null,
      action: complete ? "feature_flag_bulk_applied" : "feature_flag_bulk_failed",
      entity_type: "feature_flag_bulk",
      entity_id: null,
      meta: {
        audience,
        action,
        flags: fresh.flags.map((f) => ({ flag: f.flagName, status: f.status, outcome: f.outcome })),
        writes: fresh.writes,
        outcomes,
        fingerprint: fresh.fingerprint,
        recovery,
      },
    });
    historyLogged = !error;
  } catch {
    historyLogged = false;
  }

  revalidatePath("/admin/feature-flags");
  return { outcomes, complete, recovery, preview: fresh, historyLogged };
}

export interface FlagBulkHistoryRow {
  createdAt: string;
  action: string;
  audience: string;
  bulkAction: string;
  flags: { flag: string; status: string; outcome: string }[];
  complete: boolean;
}

export async function getFlagBulkHistoryAction(limit = 10): Promise<FlagBulkHistoryRow[]> {
  const db = await adminSession();
  if (!db) return [];
  const { data, error } = await db
    .from("activity_log")
    .select("action, created_at, meta")
    .eq("entity_type", "feature_flag_bulk")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error || !data) return [];
  return data.map((r: { action: string; created_at: string; meta: Record<string, unknown> | null }) => {
    const m = (r.meta ?? {}) as { audience?: string; action?: string; flags?: { flag: string; status: string; outcome: string }[] };
    return {
      createdAt: r.created_at,
      action: r.action,
      audience: m.audience ?? "",
      bulkAction: m.action ?? "",
      flags: Array.isArray(m.flags) ? m.flags : [],
      complete: r.action === "feature_flag_bulk_applied",
    };
  });
}
