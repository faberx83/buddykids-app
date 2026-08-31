import "server-only";

// TRAMA — Wave 3 "Actionable In-App Notifications", sezione Carpool.
// REUSE > EXTEND > NEW: la vera logica di abbinamento (compatibilità
// tratta/posti/seggiolino) è già scritta e testata in lib/carpool.ts
// (matchesForRequest, pura, usata da components/GroupDetailClient.tsx per
// mostrare "Abbinamenti proposti" dentro un singolo gruppo) — qui la
// riusiamo TALE E QUALE, applicata a TUTTI i gruppi dell'utente invece che a
// uno solo, per derivare quali abbinamenti sono "nuovi" a livello di
// notifica. Nessuna nuova regola di matching inventata qui.
//
// Scope volutamente ristretto (vedi doc implementazione, sezione "Carpool —
// perché solo questi due eventi"): notifichiamo SOLO quando un abbinamento
// compatibile esiste per una richiesta/offerta PROPRIA dell'utente, non ogni
// nuova offerta/richiesta di chiunque nel gruppo — coerente con "notify for
// action, not for activity" (sezione 1 del task).

import { createClient } from "@/lib/supabase/server";
import { matchesForRequest } from "@/lib/carpool";
import { CarpoolLeg, CarpoolOfferItem, CarpoolRequestItem } from "@/lib/types";

interface RawOfferRow {
  id: string;
  parent_id: string;
  seats_available: number;
  has_child_seat: boolean | null;
  legs: CarpoolLeg | null;
  created_at: string;
}

interface RawRequestRow {
  id: string;
  parent_id: string;
  kids_count: number;
  needs_child_seat: boolean | null;
  legs: CarpoolLeg | null;
  created_at: string;
}

export interface CarpoolMatchSignal {
  /** id della RICHIESTA o OFFERTA propria coinvolta — usato per l'id deterministico della notifica. */
  ownEntityId: string;
  groupId: string;
  groupName: string;
  /** L'offerta/richiesta altrui più recente fra quelle compatibili — determina relevantAt. */
  matchedAt: string;
}

// Per ogni gruppo di cui l'utente è membro: se ha una RICHIESTA propria e
// almeno un'OFFERTA altrui compatibile, un segnale "carpool_match_for_my_request"
// (qualcuno può darti un passaggio). Se ha un'OFFERTA propria e almeno una
// RICHIESTA altrui compatibile, un segnale "carpool_match_for_my_offer"
// (qualcuno ha bisogno di quello che offri). Un utente con sia offerta che
// richiesta nello stesso gruppo (raro ma non impedito dalla UI) può generare
// entrambi — sono condizioni realmente distinte, non un duplicato.
export async function getCarpoolMatchSignals(
  userId: string
): Promise<{ forMyRequest: CarpoolMatchSignal[]; forMyOffer: CarpoolMatchSignal[] }> {
  const supabase = await createClient();

  const { data: memberRows } = await supabase.from("group_members").select("group_id").eq("parent_id", userId);
  const groupIds = Array.from(new Set((memberRows ?? []).map((r) => r.group_id as string)));
  if (groupIds.length === 0) return { forMyRequest: [], forMyOffer: [] };

  const [{ data: groupRows }, { data: offerRows }, { data: requestRows }] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", groupIds),
    supabase
      .from("carpool_offers")
      .select("id, group_id, parent_id, seats_available, has_child_seat, legs, created_at")
      .in("group_id", groupIds),
    supabase
      .from("carpool_requests")
      .select("id, group_id, parent_id, kids_count, needs_child_seat, legs, created_at")
      .in("group_id", groupIds),
  ]);

  const groupNameById = new Map((groupRows ?? []).map((g) => [g.id as string, g.name as string]));

  const toOfferItem = (row: RawOfferRow): CarpoolOfferItem => ({
    id: row.id,
    parentId: row.parent_id,
    parentLabel: "",
    isOwn: row.parent_id === userId,
    seatsAvailable: row.seats_available,
    hasChildSeat: Boolean(row.has_child_seat),
    legs: row.legs ?? "both",
    notes: "",
  });
  const toRequestItem = (row: RawRequestRow): CarpoolRequestItem => ({
    id: row.id,
    parentId: row.parent_id,
    parentLabel: "",
    isOwn: row.parent_id === userId,
    kidsCount: row.kids_count,
    needsChildSeat: Boolean(row.needs_child_seat),
    legs: row.legs ?? "both",
  });

  const offersByGroup = new Map<string, { row: RawOfferRow; item: CarpoolOfferItem }[]>();
  for (const row of (offerRows ?? []) as (RawOfferRow & { group_id: string })[]) {
    const list = offersByGroup.get(row.group_id) ?? [];
    list.push({ row, item: toOfferItem(row) });
    offersByGroup.set(row.group_id, list);
  }
  const requestsByGroup = new Map<string, { row: RawRequestRow; item: CarpoolRequestItem }[]>();
  for (const row of (requestRows ?? []) as (RawRequestRow & { group_id: string })[]) {
    const list = requestsByGroup.get(row.group_id) ?? [];
    list.push({ row, item: toRequestItem(row) });
    requestsByGroup.set(row.group_id, list);
  }

  const forMyRequest: CarpoolMatchSignal[] = [];
  const forMyOffer: CarpoolMatchSignal[] = [];

  for (const groupId of groupIds) {
    const groupName = groupNameById.get(groupId) ?? "il tuo gruppo";
    const offers = offersByGroup.get(groupId) ?? [];
    const requests = requestsByGroup.get(groupId) ?? [];

    const myRequest = requests.find((r) => r.item.isOwn);
    if (myRequest) {
      const compatible = matchesForRequest(myRequest.item, offers.map((o) => o.item));
      if (compatible.length > 0) {
        const compatibleRows = offers.filter((o) => compatible.some((c) => c.id === o.item.id));
        const latest = compatibleRows.reduce((max, o) => (o.row.created_at > max ? o.row.created_at : max), compatibleRows[0].row.created_at);
        forMyRequest.push({ ownEntityId: myRequest.row.id, groupId, groupName, matchedAt: latest });
      }
    }

    const myOffer = offers.find((o) => o.item.isOwn);
    if (myOffer) {
      const compatibleRequests = requests.filter((r) => matchesForRequest(r.item, [myOffer.item]).length > 0);
      if (compatibleRequests.length > 0) {
        const latest = compatibleRequests.reduce(
          (max, r) => (r.row.created_at > max ? r.row.created_at : max),
          compatibleRequests[0].row.created_at
        );
        forMyOffer.push({ ownEntityId: myOffer.row.id, groupId, groupName, matchedAt: latest });
      }
    }
  }

  return { forMyRequest, forMyOffer };
}
