"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AddressKind } from "@/lib/data/addresses";
import { revalidatePath } from "next/cache";

const ADDRESSES_PATH = "/nextgen/planner/indirizzi";

// SPRINT 4 correttivo (feedback Fabrizio: "label indirizzo personalizzabili")
// — prima solo il kind "altro" poteva avere un nome libero (gli altri 3 slot
// mostravano sempre l'etichetta fissa "Casa"/"Lavoro Genitore 1"/"Lavoro
// Genitore 2"). La colonna "label" esisteva già per tutti i kind (vedi
// supabase/schema.sql), qui era solo bloccata lato azione: ora è opzionale
// per ogni kind, non solo obbligatoria per "altro" — es. un genitore single
// può rinominare "Lavoro Genitore 2" in "Casa della nonna" senza dover usare
// lo slot "Altro". Se lasciata vuota per un kind fisso, la UI ricade
// sull'etichetta di default (vedi ADDRESS_KIND_LABELS in
// lib/nextgen/address-kinds.ts).
export async function setAddressAction(
  kind: AddressKind,
  address: string,
  label?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!address.trim()) return { error: "Inserisci un indirizzo" };
  if (kind === "altro" && !label?.trim()) return { error: "Dai un nome a questo indirizzo (es. \"Casa dei nonni\")" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const trimmedLabel = label?.trim();
  const { error } = await supabase.from("parent_addresses").upsert(
    {
      parent_id: user.id,
      kind,
      label: trimmedLabel ? trimmedLabel : null,
      address: address.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "parent_id,kind" }
  );

  if (error) return { error: error.message };
  revalidatePath(ADDRESSES_PATH);
  return {};
}

export async function deleteAddressAction(kind: AddressKind): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("parent_addresses")
    .delete()
    .eq("parent_id", user.id)
    .eq("kind", kind);

  if (error) return { error: error.message };
  revalidatePath(ADDRESSES_PATH);
  return {};
}
