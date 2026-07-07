"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

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
    .eq("email", email)
    .maybeSingle();

  if (findError || !profile) {
    return {
      ...result,
      warning:
        "Centro creato, ma nessun utente registrato trovato con questa email. Chiedi alla persona di registrarsi nell'app, poi assegnale il ruolo dalla stessa pagina.",
    };
  }

  const { error: assignError } = await supabase
    .from("profiles")
    .update({ role: "center_admin", center_id: center.id })
    .eq("id", profile.id);

  if (assignError) {
    return { ...result, warning: `Centro creato, ma l'assegnazione del ruolo è fallita: ${assignError.message}` };
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

  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.trim())
    .maybeSingle();

  if (findError || !profile) {
    return { error: "Nessun utente registrato trovato con questa email." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "center_admin", center_id: centerId })
    .eq("id", profile.id);

  if (error) return { error: error.message };
  return {};
}
