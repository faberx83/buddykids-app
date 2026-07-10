"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ParentRole, Gender, BusinessRole, Language, Theme } from "@/lib/data/profile";
import { revalidatePath } from "next/cache";

// Percorsi da rigenerare dopo una modifica al profilo — entrambe le sezioni
// (genitore e gestore) leggono dalla stessa tabella "profiles".
const PROFILE_PATHS = ["/profile", "/center/account", "/"];

function revalidateProfilePaths() {
  for (const path of PROFILE_PATHS) revalidatePath(path);
}

export async function updateParentProfileAction(input: {
  fullName: string;
  parentRole?: ParentRole;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  // Solo lato gestore (vedi ProfileHeaderClient, showBusinessRole) — non
  // pertinente per il genitore, che non lo invia mai.
  businessRole?: BusinessRole;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.fullName.trim()) return { error: "Inserisci nome e cognome" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      ...(input.parentRole ? { parent_role: input.parentRole } : {}),
      phone: input.phone?.trim() || null,
      date_of_birth: input.dateOfBirth || null,
      gender: input.gender || null,
      ...(input.businessRole !== undefined ? { business_role: input.businessRole || null } : {}),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidateProfilePaths();
  return {};
}

// Salva la foto profilo caricata su Storage (vedi lib/storage.ts) — l'upload
// del file avviene lato client, qui salviamo solo l'URL pubblico risultante.
export async function updateParentAvatarAction(avatarUrl: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidateProfilePaths();
  return {};
}

// Preferenze: lingua, tema, notifiche (email/push/SMS).
export async function updatePreferencesAction(input: {
  language?: Language;
  theme?: Theme;
  notifyEmail?: boolean;
  notifyPush?: boolean;
  notifySms?: boolean;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const update: Record<string, string | boolean> = {};
  if (input.language !== undefined) update.language = input.language;
  if (input.theme !== undefined) update.theme = input.theme;
  if (input.notifyEmail !== undefined) update.notify_email = input.notifyEmail;
  if (input.notifyPush !== undefined) update.notify_push = input.notifyPush;
  if (input.notifySms !== undefined) update.notify_sms = input.notifySms;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: error.message };

  revalidateProfilePaths();
  return {};
}

// Consenso marketing/cookie (privacy) — separato dalle preferenze notifiche
// funzionali, perché ha un significato legale diverso (opt-in commerciale).
export async function updateMarketingConsentAction(consent: boolean): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ marketing_consent: consent })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidateProfilePaths();
  return {};
}

// Cambio password — usa la sessione già autenticata dell'utente corrente
// (supabase.auth.updateUser), non richiede la vecchia password lato server
// perché Supabase Auth gestisce già la validità della sessione stessa.
export async function changePasswordAction(newPassword: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!newPassword || newPassword.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return {};
}

// Disattivazione temporanea dell'account (reversibile: un admin può
// riportare account_status a 'active'). Non elimina alcun dato.
export async function deactivateAccountAction(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "deactivated" })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return {};
}

// Richiesta di cancellazione definitiva (diritto all'oblio, GDPR art. 17).
// L'app non ha un client con permessi di servizio per eliminare l'utente da
// auth.users lato server (di proposito: la service role key non deve mai
// girare nel codice applicativo) — la richiesta viene quindi marcata sul
// profilo con data/ora e va evasa manualmente da un platform_admin dal SQL
// Editor di Supabase, come già avviene per la promozione di ruolo.
export async function requestAccountDeletionAction(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "deletion_requested", deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidateProfilePaths();
  return {};
}

// Settimane del Planner segnate dal genitore come "non mi serve" (ferie,
// bambini dai nonni, ecc.) — persistite come array di date ISO (inizio
// settimana) sul profilo, così restano anche cambiando dispositivo.
export async function toggleWeekDismissedAction(
  weekStartDate: string,
  dismissed: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("dismissed_weeks")
    .eq("id", user.id)
    .single();

  const current: string[] = Array.isArray(profile?.dismissed_weeks) ? profile.dismissed_weeks : [];
  const next = dismissed
    ? Array.from(new Set([...current, weekStartDate]))
    : current.filter((d) => d !== weekStartDate);

  const { error } = await supabase
    .from("profiles")
    .update({ dismissed_weeks: next })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}
