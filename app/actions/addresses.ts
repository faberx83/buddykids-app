"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AddressKind } from "@/lib/data/addresses";
import { revalidatePath } from "next/cache";

const ADDRESSES_PATH = "/nextgen/planner/indirizzi";

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

  const { error } = await supabase.from("parent_addresses").upsert(
    {
      parent_id: user.id,
      kind,
      label: kind === "altro" ? label!.trim() : null,
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
