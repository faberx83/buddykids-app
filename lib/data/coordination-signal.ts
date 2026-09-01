import "server-only";

// TRAMA — Wave 2 "Coordination Resurfacing" (audit TRAMA_PILOT_ARCHITECTURE_
// REVIEW.md sez.2/12: "la Home può mostrare non solo 'cosa deve fare mio
// figlio' ma anche 'con chi siamo organizzati e cosa manca da coordinare'?").
// Generalizza getCommunityHomeSignal() (lib/data/communities.ts, invariata,
// riusata qui come ramo "low") senza introdurre nessuna nuova tabella:
// riusa la RPC list_my_group_invites() (migration_25, già usata da
// lib/data/groups.ts#getMyGroupInvites) e una query aggiuntiva di sola
// lettura su group_requests/group_members (stesse tabelle già lette altrove
// nel progetto, RLS invariata).
//
// Priorità (mai più di UN segnale mostrato in Home):
//  0. HIGH   — manca chi accompagna/ritira un bambino OGGI (01/09/2026,
//              richiesta di Fabrizio) — controllata PRIMA dell'invito di
//              gruppo: un invito può aspettare un giorno, "chi porta il
//              bambino oggi" no.
//  1. HIGH   — un'azione è richiesta all'utente (invito di gruppo pendente:
//              accetta/rifiuta).
//  2. MEDIUM — un aggiornamento organizzativo rilevante (una richiesta
//              gruppo è stata appena accettata dal centro — sconto
//              ottenuto), solo se recente (14 giorni: senza questa finestra
//              un'accettazione vecchia resterebbe visibile per sempre, dato
//              che questa wave non introduce un concetto di "letto/non
//              letto" per group_requests).
//  3. LOW    — segnale sociale informativo (Community con proposta
//              interessante) — comportamento invariato rispetto a prima.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCommunityHomeSignal } from "./communities";
import { getTodayResponsibilities } from "./responsibilities";
import { CoordinationSignal } from "@/lib/types";

const GROUP_REQUEST_RECENCY_DAYS = 14;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface AcceptedGroupRequestSignal {
  id: string;
  groupId: string;
  groupName: string;
  discountPercent: number;
  respondedAt: string;
}

// TRAMA — Wave 3 (31/08/2026, "coerenza con Coordination Signal", refactor
// locale esplicitamente permesso dal task): estratta da dentro
// getCoordinationSignal() per essere la STESSA fonte di verità usata anche da
// lib/data/notifications.ts — "richiesta gruppo accettata" deve restare un
// solo pezzo di logica (query + finestra di recency), non due copie che
// potrebbero divergere. Il ramo Home (sotto) continua a usarne solo il primo
// elemento; le Notifiche possono mostrarne fino a `limit`.
export async function getRecentAcceptedGroupRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number = 1
): Promise<AcceptedGroupRequestSignal[]> {
  const { data: memberRows } = await supabase.from("group_members").select("group_id").eq("parent_id", userId);
  const groupIds = (memberRows ?? []).map((r) => r.group_id as string);
  if (groupIds.length === 0) return [];

  const since = new Date(Date.now() - GROUP_REQUEST_RECENCY_DAYS * 86_400_000).toISOString();
  const { data: acceptedRows } = await supabase
    .from("group_requests")
    .select("id, group_id, discount_percent, responded_at, groups ( name )")
    .in("group_id", groupIds)
    .eq("status", "accepted")
    .gte("responded_at", since)
    .order("responded_at", { ascending: false })
    .limit(limit);

  return ((acceptedRows ?? []) as {
    id: string;
    group_id: string;
    discount_percent: number;
    responded_at: string;
    groups: { name: string } | { name: string }[] | null;
  }[]).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: firstOf(row.groups)?.name ?? "il tuo gruppo",
    discountPercent: row.discount_percent,
    respondedAt: row.responded_at,
  }));
}

export async function getCoordinationSignal(): Promise<CoordinationSignal | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 0) HIGH — manca chi accompagna/ritira un bambino OGGI (solo per bambini
  // con un'attività reale oggi, vedi getTodayResponsibilities per il motivo
  // per cui questo non rischia i falsi positivi del gap documentato).
  const todayGaps = (await getTodayResponsibilities()).filter((r) => r.responsible === null);
  if (todayGaps.length > 0) {
    const gap = todayGaps[0];
    return {
      kind: "responsibility_unassigned_today",
      priority: "high",
      kidId: gap.kidId,
      kidName: gap.kidName,
      moment: gap.moment,
    };
  }

  // 1) HIGH — invito di gruppo pendente (stessa RPC di getMyGroupInvites,
  // qui basta sapere se ce n'è almeno uno).
  const { data: inviteRows } = await supabase.rpc("list_my_group_invites").limit(1);
  if (inviteRows && inviteRows.length > 0) {
    const row = inviteRows[0] as { group_id: string; group_name: string };
    return { kind: "group_invite_pending", priority: "high", groupId: row.group_id, groupName: row.group_name };
  }

  // 2) MEDIUM — richiesta gruppo accettata di recente, per un gruppo di cui
  // l'utente è membro (stessa funzione condivisa con le Notifiche, qui
  // basta il più recente).
  const [accepted] = await getRecentAcceptedGroupRequests(supabase, user.id, 1);
  if (accepted) {
    return {
      kind: "group_request_accepted",
      priority: "medium",
      groupId: accepted.groupId,
      groupName: accepted.groupName,
      discountPercent: accepted.discountPercent,
    };
  }

  // 3) LOW — segnale Community, invariato.
  const community = await getCommunityHomeSignal();
  if (community) {
    return { kind: "community", priority: "low", ...community };
  }

  return null;
}
