// Stato del profilo genitore (nome/cognome + ruolo padre/madre/tutore) — usato
// sia dalla pagina Profilo (per precompilare il form di modifica) sia dalla
// Home (per capire se mostrare il prompt "completa il profilo"). In modalità
// demo (Supabase non collegato) il profilo è sempre considerato completo: è
// una vetrina con dati finti, non un vero nuovo utente da guidare.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ParentRole = "padre" | "madre" | "tutore";

export interface ParentProfile {
  fullName: string;
  email: string;
  parentRole: ParentRole | null;
  avatarUrl: string | null;
}

export async function getParentProfile(): Promise<ParentProfile> {
  const fallback: ParentProfile = {
    fullName: "Sofia Ferretti",
    email: "sofia.ferretti@email.it",
    parentRole: "madre",
    avatarUrl: null,
  };
  if (!isSupabaseConfigured) return fallback;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallback;

  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, parent_role, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    fullName: data?.full_name?.trim() || "",
    email: data?.email || user.email || "",
    parentRole: (data?.parent_role as ParentRole | null) ?? null,
    avatarUrl: data?.avatar_url ?? null,
  };
}

// Usata dalla Home: profilo "incompleto" solo per utenti reali che non hanno
// ancora inserito nome o ruolo — in demo è sempre false (profilo già "completo").
export async function isParentProfileIncomplete(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const profile = await getParentProfile();
  return !profile.fullName || !profile.parentRole;
}
