// TRAMA — LISTA D'ATTESA (20/10/2026). Lettura Admin di public.beta_waitlist
// (migration_44): RLS lascia leggere solo l'Admin piattaforma. Tabella non
// ancora creata → lista vuota con avviso, mai un errore a schermo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AccountRef } from "@/lib/admin-ops/invitations";

// LOTTO 2 (16/11/2026): ogni richiesta porta l'account con la stessa email
// (qualunque ruolo), così Oggi, Lista d'attesa e Famiglie applicano la stessa
// regola (lib/admin-ops/invitations.ts#inviteQueueState). Sola lettura.

export type WaitlistStatus = "nuovo" | "invitato" | "archiviato";

export interface WaitlistItem {
  id: string;
  email: string;
  comune: string | null;
  kidsCount: number | null;
  note: string | null;
  source: string | null;
  status: WaitlistStatus;
  createdAt: string;
  invitedAt: string | null;
  /** Account con la stessa email (null = nessuno). */
  account: AccountRef | null;
}

export interface WaitlistAdminData {
  items: WaitlistItem[];
  /** false = migration_44 non ancora applicata */
  tableReady: boolean;
  /** visite alla pagina di benvenuto negli ultimi 30 giorni (indicativo) */
  views30d: number | null;
}

export async function getWaitlistForAdmin(): Promise<WaitlistAdminData> {
  if (!isSupabaseConfigured) return { items: [], tableReady: false, views30d: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_waitlist")
    .select("id, email, comune, kids_count, note, source, status, created_at, invited_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const views = await supabase
    .from("product_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "landing_viewed")
    .gte("created_at", since);
  const views30d = views.error ? null : (views.count ?? 0);
  if (error) return { items: [], tableReady: false, views30d };
  const accounts = await findAccountsByEmail(
    supabase,
    (data ?? []).map((r: { email: string }) => r.email)
  );
  return {
    tableReady: true,
    views30d,
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      comune: (r.comune as string | null) ?? null,
      kidsCount: (r.kids_count as number | null) ?? null,
      note: (r.note as string | null) ?? null,
      source: (r.source as string | null) ?? null,
      status: r.status as WaitlistStatus,
      createdAt: r.created_at as string,
      invitedAt: (r.invited_at as string | null) ?? null,
      account: accounts.get(((r.email as string) ?? "").trim().toLowerCase()) ?? null,
    })),
  };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Account per email (minuscole, qualunque ruolo) e se hanno una scheda in
 * Pilota (riga in beta_cohort_memberships). Tollerante: errore = nessun
 * account trovato, mai un'eccezione.
 */
export async function findAccountsByEmail(supabase: Db, emails: string[]): Promise<Map<string, AccountRef>> {
  const out = new Map<string, AccountRef>();
  const list = Array.from(new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean)));
  if (list.length === 0) return out;
  const { data, error } = await supabase.from("profiles").select("id, email, created_at, beta_invited_by_code").in("email", list);
  if (error || !data) return out;
  type P = { id: string; email: string | null; created_at: string; beta_invited_by_code: string | null };
  const profiles = data as P[];
  const ids = profiles.map((p) => p.id);
  const { data: cohort } = ids.length
    ? await supabase.from("beta_cohort_memberships").select("user_id").in("user_id", ids)
    : { data: [] as { user_id: string }[] };
  const inPilot = new Set(((cohort ?? []) as { user_id: string }[]).map((c) => c.user_id));
  for (const p of profiles) {
    const key = (p.email ?? "").trim().toLowerCase();
    if (!key || out.has(key)) continue;
    out.set(key, {
      id: p.id,
      createdAt: p.created_at,
      betaCode: p.beta_invited_by_code ?? null,
      inPilot: inPilot.has(p.id),
    });
  }
  return out;
}
