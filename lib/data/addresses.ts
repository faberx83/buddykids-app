// SPRINT 5.3 (NEXTGEN) — Family Planner, "Logistica leggera": indirizzi
// salvati dal genitore (Casa, Lavoro Genitore 1, Lavoro Genitore 2, Altro).
// Solo testo libero, NESSUNA geocodifica: il pulsante "Apri in Maps" della UI
// costruisce un link diretto (Google/Apple Maps) da questo testo, senza
// bisogno di alcuna API a pagamento. La vera distanza/tempo stimato (che
// richiede una API mappe) resta stubbata fino alla fase 5.4 — vedi
// supabase/schema.sql per il commento esteso.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
// Tipi/costanti spostati in un modulo client-safe (niente import di
// lib/supabase/server): vedi commento in lib/nextgen/address-kinds.ts. Ri-
// esportati qui per non rompere chi già importava da questo file lato server.
import { AddressKind, ParentAddress, ADDRESS_KINDS, ADDRESS_KIND_LABELS } from "@/lib/nextgen/address-kinds";
export type { AddressKind, ParentAddress };
export { ADDRESS_KIND_LABELS };

interface RawAddressRow {
  kind: string;
  label: string | null;
  address: string;
}

// Restituisce SEMPRE i 4 slot, anche quelli non ancora impostati (address:
// "") — così la UI può renderizzare 4 card fisse senza dover gestire "quali
// esistono già", coerente con l'idea di "logistica leggera" (nessuno stato
// intermedio da modellare).
export async function getParentAddresses(): Promise<ParentAddress[]> {
  const empty: ParentAddress[] = ADDRESS_KINDS.map((kind) => ({ kind, label: null, address: "" }));
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from("parent_addresses")
    .select("kind, label, address")
    .eq("parent_id", user.id);

  if (error || !data) return empty;

  const rows = data as RawAddressRow[];
  return ADDRESS_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    return { kind, label: row?.label ?? null, address: row?.address ?? "" };
  });
}
