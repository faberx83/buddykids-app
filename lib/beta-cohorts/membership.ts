import "server-only";

// TRAMA ONE — Beta cohort membership reader (Build Sprint 0)
//
// Server-only per costruzione (import "server-only" sopra: la build fallisce
// se questo modulo viene importato da un Client Component). Usa
// createServiceClient() (service_role, bypassa RLS) — MAI il client anon
// (lib/supabase/server.ts) né tanto meno quello browser
// (lib/supabase/client.ts): la RLS su beta_cohort_memberships nega la
// lettura a chiunque non sia platform_admin (vedi
// supabase/migration_08_beta_cohort_memberships.sql), quindi nessun utente
// normale può leggere o modificare la propria appartenenza — nemmeno
// indirettamente tramite il client anon lato server. Questo modulo è
// l'UNICO punto del codebase autorizzato a leggere questa tabella, ed è
// chiamato solo da lib/feature-flags/resolve.ts.
//
// Nessuna UI Admin per l'assegnazione in questo sprint: l'unico modo per
// aggiungere/rimuovere una membership è uno script/SQL amministrativo
// controllato (vedi supabase/migration_08_beta_cohort_memberships.sql,
// sezione commenti in fondo, e la procedura descritta in
// docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md).

import { createServiceClient } from "@/lib/supabase/service";
import { cohortsToInherit, type CohortRow } from "@/lib/beta-cohorts/family-inherit";
import { isBetaCodeUsable, normalizeBetaCode, type BetaCodeRow, type BetaJoinOutcome } from "@/lib/beta-cohorts/code";

/**
 * Ritorna le cohort_key attive e non scadute per l'utente indicato.
 * Fallback sicuro: qualunque errore (client non configurato, errore DB,
 * timeout) ritorna un array vuoto — mai un'eccezione propagata al
 * chiamante, mai un utente considerato "in una coorte" per errore.
 */
export async function getActiveCohortKeys(userId: string): Promise<string[]> {
  if (!userId) return [];

  try {
    const client = createServiceClient();
    if (!client) return [];

    const { data, error } = await client
      .from("beta_cohort_memberships")
      .select("cohort_key, active, expires_at")
      .eq("user_id", userId)
      .eq("active", true);

    if (error || !data) return [];

    const now = Date.now();
    return data
      .filter((row) => !row.expires_at || Date.parse(row.expires_at) > now)
      .map((row) => row.cohort_key as string);
  } catch {
    return [];
  }
}

/**
 * 19/11/2026 — l'altro genitore entra nella stessa beta di chi l'ha invitato.
 * Chiamata dopo l'adesione a una famiglia (invito via link o codice). Legge
 * gli adulti della famiglia e le loro coorti (service role, come sopra) e
 * aggiunge a `userId` quelle ereditabili (lib/beta-cohorts/family-inherit.ts).
 * Best-effort: un errore non blocca mai l'adesione, viene solo scritto nel log.
 * Mai sovrascritte righe esistenti (ignoreDuplicates su user_id+cohort_key).
 */
export async function inheritFamilyCohorts(familyId: string, userId: string): Promise<string[]> {
  if (!familyId || !userId) return [];
  try {
    const client = createServiceClient();
    if (!client) return [];
    const { data: members, error: mErr } = await client.from("family_members").select("parent_id").eq("family_id", familyId);
    if (mErr || !members) return [];
    const ids = Array.from(new Set([userId, ...(members as { parent_id: string }[]).map((m) => m.parent_id)]));
    if (ids.length < 2) return [];
    const { data: rows, error: rErr } = await client
      .from("beta_cohort_memberships")
      .select("user_id, cohort_key, active, expires_at")
      .in("user_id", ids);
    if (rErr || !rows) return [];
    const toAdd = cohortsToInherit(userId, rows as CohortRow[]);
    if (toAdd.length === 0) return [];
    const { error: iErr } = await client.from("beta_cohort_memberships").upsert(
      toAdd.map((c) => ({
        user_id: userId,
        cohort_key: c.cohort_key,
        active: true,
        expires_at: c.expires_at,
        created_by: c.from_user_id,
        updated_by: c.from_user_id,
      })),
      { onConflict: "user_id,cohort_key", ignoreDuplicates: true }
    );
    if (iErr) {
      console.error("[beta] coorte dell'altro genitore non assegnata", iErr.message);
      return [];
    }
    return toAdd.map((c) => c.cohort_key);
  } catch (e) {
    console.error("[beta] coorte dell'altro genitore non assegnata", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * 20/11/2026 — chi ha GIÀ un account e apre un link beta (/auth/login?beta=…)
 * entra nella coorte del codice, come se si fosse registrato da quel link.
 * Stesse regole del trigger handle_new_user: codice attivo, non scaduto, non
 * esaurito; conta un utilizzo e segna beta_invited_by_code se vuoto. Service
 * role (la RLS su beta_cohort_memberships e beta_invite_codes è solo Admin).
 */
export async function joinBetaCohortWithCode(userId: string, rawCode: string): Promise<BetaJoinOutcome> {
  const code = normalizeBetaCode(rawCode);
  if (!userId || !code) return "invalid";
  try {
    const client = createServiceClient();
    if (!client) return "error";
    const { data: row, error } = await client
      .from("beta_invite_codes")
      .select("code, cohort_key, active, expires_at, max_redemptions, redeemed_count")
      .eq("code", code)
      .maybeSingle();
    if (error) return "error";
    if (!row || !isBetaCodeUsable(row as BetaCodeRow)) return "invalid";
    const cohortKey = (row as { cohort_key: string }).cohort_key;

    const { data: existing } = await client
      .from("beta_cohort_memberships")
      .select("id, active")
      .eq("user_id", userId)
      .eq("cohort_key", cohortKey)
      .maybeSingle();
    // Una riga spenta da Admin resta spenta: è una scelta, non un buco.
    if (existing) return (existing as { active: boolean }).active ? "already" : "invalid";

    const { error: iErr } = await client
      .from("beta_cohort_memberships")
      .insert({ user_id: userId, cohort_key: cohortKey, active: true });
    if (iErr) return "error";
    await client
      .from("beta_invite_codes")
      .update({ redeemed_count: (row as { redeemed_count: number }).redeemed_count + 1 })
      .eq("code", code);
    await client.from("profiles").update({ beta_invited_by_code: code }).eq("id", userId).is("beta_invited_by_code", null);
    return "joined";
  } catch {
    return "error";
  }
}
