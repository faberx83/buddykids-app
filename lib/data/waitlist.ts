// TRAMA — LISTA D'ATTESA (20/10/2026). Lettura Admin di public.beta_waitlist
// (migration_44): RLS lascia leggere solo l'Admin piattaforma. Tabella non
// ancora creata → lista vuota con avviso, mai un errore a schermo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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
    })),
  };
}
