"use server";

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: creazione/adesione
// (tramite codice invito — stesso pattern di app/actions/communities.ts) ed
// uscita dalla famiglia. Una volta nella stessa famiglia, i genitori
// condividono lettura/scrittura su Indirizzi/"Chi fa cosa?"/Condivisione
// Piano (RLS aggiornata in supabase/schema.sql) — bambini/prenotazioni
// restano invariati e solo-proprietario.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Stessi caratteri di app/actions/communities.ts (niente 0/O/1/I, ambigui da
// leggere/dettare a voce quando il codice viene condiviso a mano, es. col
// partner al telefono).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function generateUniqueInviteCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data } = await supabase.from("families").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return code;
  }
  return randomCode(8); // fallback, collisione estremamente improbabile
}

const PLANNER_FAMILY_PATH = "/nextgen/planner/famiglia";

export async function createFamilyAction(
  name: string
): Promise<{ familyId?: string; inviteCode?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!name.trim()) return { error: "Inserisci un nome per la famiglia" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: existing } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (existing) return { error: "Fai già parte di una famiglia. Esci prima di crearne una nuova." };

  const code = await generateUniqueInviteCode(supabase);
  const { data: family, error } = await supabase
    .from("families")
    .insert({ name: name.trim(), created_by: user.id, invite_code: code })
    .select("id")
    .single();
  if (error || !family) return { error: error?.message || "Errore nella creazione della famiglia" };

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, parent_id: user.id, role: "creatore" });
  if (memberError) return { error: memberError.message };

  revalidatePath(PLANNER_FAMILY_PATH);
  return { familyId: family.id, inviteCode: code };
}

function friendlyDbError(message: string, fallback: string): string {
  if (message.includes("family_members_pkey") || message.includes("duplicate key")) {
    return "Fai già parte di questa famiglia.";
  }
  return fallback || message;
}

export async function joinFamilyByCodeAction(
  inviteCode: string
): Promise<{ familyId?: string; error?: string; alreadyMember?: boolean }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const code = inviteCode.trim().toUpperCase();
  if (!code) return { error: "Inserisci un codice invito" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: existing } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (existing) return { error: "Fai già parte di una famiglia. Esci prima di entrare in un'altra." };

  const { data: family, error: findError } = await supabase
    .from("families")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();
  if (findError || !family) return { error: "Codice non valido. Controlla e riprova." };

  const { error } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, parent_id: user.id, role: "membro" });
  if (error) return { error: friendlyDbError(error.message, "Errore nell'adesione alla famiglia") };

  revalidatePath(PLANNER_FAMILY_PATH);
  return { familyId: family.id };
}

export async function leaveFamilyAction(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("family_members").delete().eq("parent_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(PLANNER_FAMILY_PATH);
  return {};
}
