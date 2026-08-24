"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

// PRE-LAUNCH REMEDIATION WAVE 1 — R-14 (decisione Fabrizio, 24/08/2026):
// entrambe le azioni sotto si affidavano ESCLUSIVAMENTE alla RLS di
// "centers"/"profiles" (is_platform_admin() nella policy, vedi
// supabase/schema.sql) per impedire a un utente non-Admin di creare centri
// o assegnare ruoli — nessun controllo applicativo esplicito PRIMA della
// scrittura. Difesa in profondità: se la policy RLS avesse mai un bug o
// venisse disabilitata per errore in una migrazione futura, questo file da
// solo non fermerebbe più nulla. Aggiunto qui un controllo esplicito del
// ruolo del chiamante, che fallisce velocemente con un messaggio chiaro
// PRIMA di toccare il database — la RLS resta comunque la barriera reale e
// non viene rimossa/indebolita in alcun modo.
async function requireCallerIsPlatformAdmin(
  supabase: SupabaseClient
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "platform_admin") {
    return { error: "Non hai i permessi di Admin piattaforma per questa azione." };
  }

  return { userId: user.id };
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface CreateCenterInput {
  name: string;
  city: string;
  address: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  gestoreEmail?: string; // email di un utente GIÀ registrato da promuovere a center_admin
}

export interface CreateCenterResult {
  centerId?: string;
  centerName?: string;
  assigned?: boolean; // true se il gestore è stato assegnato con successo
  warning?: string; // es. "centro creato ma nessun utente trovato con questa email"
  error?: string;
}

// Crea un nuovo centro e, se indicata, assegna un utente GIÀ registrato come
// suo center_admin. Solo un Admin piattaforma può farlo (impostato dalle
// policy RLS su "centers" e "profiles" — la scrittura fallisce silenziosamente
// con un errore Postgres se chi chiama non è admin).
export async function createCenterAndAssignAction(
  input: CreateCenterInput
): Promise<CreateCenterResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.name.trim()) return { error: "Inserisci il nome del centro" };

  const supabase = await createClient();
  const callerCheck = await requireCallerIsPlatformAdmin(supabase);
  if ("error" in callerCheck) return { error: callerCheck.error };

  const slug = slugify(input.name);

  const { data: center, error } = await supabase
    .from("centers")
    .insert({
      slug,
      name: input.name.trim(),
      city: input.city.trim() || "Milano",
      address: input.address.trim() || null,
      description: input.description.trim() || null,
      contact_email: input.contactEmail.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
    })
    .select("id, name")
    .single();

  if (error || !center) {
    return {
      error:
        error?.code === "42501" || error?.message?.includes("policy")
          ? "Non hai i permessi di Admin piattaforma per creare un centro."
          : error?.message || "Errore nella creazione del centro",
    };
  }

  const result: CreateCenterResult = { centerId: center.id, centerName: center.name };

  const email = input.gestoreEmail?.trim();
  if (!email) return result;

  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (findError || !profile) {
    return {
      ...result,
      warning:
        "Centro creato, ma nessun utente registrato trovato con questa email. Verifica che l'indirizzo sia scritto esattamente come nel profilo (Supabase → Table Editor → profiles), oppure chiedi alla persona di registrarsi nell'app e poi assegnale il ruolo dalla stessa pagina.",
    };
  }

  // BUGFIX (Fabrizio, 05/08: "faberx83+partnernew mi riporta nella home
  // genitori" nonostante candidatura approvata): la policy RLS storica su
  // "profiles" (supabase/schema.sql) ha un WITH CHECK (auth.uid() = id) SENZA
  // l'eccezione is_platform_admin() che invece è presente nello USING — un
  // admin può quindi "targettare" la riga di un altro utente ma Postgres
  // scarta comunque la scrittura (0 righe, nessun errore restituito dal
  // client Supabase). Il fix reale è la migrazione RLS
  // (migration_22_profiles_admin_write_rls_fix.sql); questo .select() dopo
  // l'update è la difesa applicativa per non riportare mai più "assigned:
  // true" quando in realtà 0 righe sono state scritte.
  const { data: updatedRows, error: assignError } = await supabase
    .from("profiles")
    .update({ role: "center_admin", center_id: center.id })
    .eq("id", profile.id)
    .select("id");

  if (assignError) {
    return { ...result, warning: `Centro creato, ma l'assegnazione del ruolo è fallita: ${assignError.message}` };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return {
      ...result,
      warning:
        "Centro creato, ma l'assegnazione del ruolo NON è stata scritta (0 righe aggiornate, nessun errore Postgres — tipico di un blocco RLS silenzioso). Verifica la policy RLS su 'profiles' (WITH CHECK) prima di considerare l'utente assegnato.",
    };
  }

  return { ...result, assigned: true };
}

// Assegna (o riassegna) un utente già registrato come center_admin di un
// centro esistente — utile se in fase di creazione non era ancora iscritto.
export async function assignCenterAdminAction(
  centerId: string,
  email: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const callerCheck = await requireCallerIsPlatformAdmin(supabase);
  if ("error" in callerCheck) return { error: callerCheck.error };

  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  if (findError || !profile) {
    return { error: "Nessun utente registrato trovato con questa email." };
  }

  // Stesso bug RLS silenzioso di createCenterAndAssignAction sopra: senza
  // .select() questo update può scrivere 0 righe e restituire comunque
  // nessun errore.
  const { data: updatedRows, error } = await supabase
    .from("profiles")
    .update({ role: "center_admin", center_id: centerId })
    .eq("id", profile.id)
    .select("id");

  if (error) return { error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      error:
        "Assegnazione non scritta (0 righe, nessun errore Postgres — probabile blocco RLS silenzioso su 'profiles'). Vedi migration_22_profiles_admin_write_rls_fix.sql.",
    };
  }
  return {};
}
