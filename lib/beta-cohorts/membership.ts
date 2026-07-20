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
