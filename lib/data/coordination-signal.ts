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
import { CoordinationSignal } from "@/lib/types";

const GROUP_REQUEST_RECENCY_DAYS = 14;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCoordinationSignal(): Promise<CoordinationSignal | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1) HIGH — invito di gruppo pendente (stessa RPC di getMyGroupInvites,
  // qui basta sapere se ce n'è almeno uno).
  const { data: inviteRows } = await supabase.rpc("list_my_group_invites").limit(1);
  if (inviteRows && inviteRows.length > 0) {
    const row = inviteRows[0] as { group_id: string; group_name: string };
    return { kind: "group_invite_pending", priority: "high", groupId: row.group_id, groupName: row.group_name };
  }

  // 2) MEDIUM — richiesta gruppo accettata di recente, per un gruppo di cui
  // l'utente è membro.
  const { data: memberRows } = await supabase.from("group_members").select("group_id").eq("parent_id", user.id);
  const groupIds = (memberRows ?? []).map((r) => r.group_id as string);
  if (groupIds.length > 0) {
    const since = new Date(Date.now() - GROUP_REQUEST_RECENCY_DAYS * 86_400_000).toISOString();
    const { data: acceptedRows } = await supabase
      .from("group_requests")
      .select("group_id, discount_percent, responded_at, groups ( name )")
      .in("group_id", groupIds)
      .eq("status", "accepted")
      .gte("responded_at", since)
      .order("responded_at", { ascending: false })
      .limit(1);

    if (acceptedRows && acceptedRows.length > 0) {
      const row = acceptedRows[0] as {
        group_id: string;
        discount_percent: number;
        groups: { name: string } | { name: string }[] | null;
      };
      const groupName = firstOf(row.groups)?.name ?? "il tuo gruppo";
      return {
        kind: "group_request_accepted",
        priority: "medium",
        groupId: row.group_id,
        groupName,
        discountPercent: row.discount_percent,
      };
    }
  }

  // 3) LOW — segnale Community, invariato.
  const community = await getCommunityHomeSignal();
  if (community) {
    return { kind: "community", priority: "low", ...community };
  }

  return null;
}
