// Stato del profilo personale dell'utente loggato (genitore O gestore centro
// — "profiles" è la tabella condivisa da entrambi i ruoli, quindi la stessa
// funzione serve sia la pagina Profilo genitore sia "Il mio account" gestore).
// In modalità demo (Supabase non collegato) il profilo è sempre considerato
// completo/di esempio: è una vetrina con dati finti, non un vero nuovo utente
// da guidare.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ParentRole = "padre" | "madre" | "tutore";
export type Gender = "M" | "F" | "altro";
export type Language = "it" | "en";
export type Theme = "light" | "dark";
export type AccountStatus = "active" | "deactivated" | "deletion_requested";
// Segnalazione di Fabrizio: nella scheda profilo PERSONALE del gestore ("Il
// mio account") genere/data di nascita non servono — meglio un ruolo
// aziendale. Rilevante SOLO lato gestore (vedi ProfileHeaderClient,
// showBusinessRole).
export type BusinessRole = "titolare" | "responsabile" | "amministrazione" | "staff";

export interface ParentProfile {
  fullName: string;
  email: string;
  parentRole: ParentRole | null;
  avatarUrl: string | null;
  // Dati personali
  phone: string;
  dateOfBirth: string | null; // ISO (yyyy-mm-dd)
  gender: Gender | null;
  businessRole: BusinessRole | null; // solo lato gestore
  // Preferenze
  language: Language;
  theme: Theme;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  // Privacy e account
  marketingConsent: boolean;
  accountStatus: AccountStatus;
  deletionRequestedAt: string | null;
}

const DEMO_PROFILE: ParentProfile = {
  fullName: "Sofia Ferretti",
  email: "sofia.ferretti@email.it",
  parentRole: "madre",
  avatarUrl: null,
  phone: "",
  dateOfBirth: null,
  gender: null,
  businessRole: null,
  language: "it",
  theme: "light",
  notifyEmail: true,
  notifyPush: true,
  notifySms: false,
  marketingConsent: false,
  accountStatus: "active",
  deletionRequestedAt: null,
};

const PROFILE_SELECT =
  "full_name, email, parent_role, avatar_url, phone, date_of_birth, gender, business_role, language, theme, notify_email, notify_push, notify_sms, marketing_consent, account_status, deletion_requested_at";

interface RawProfileRow {
  full_name: string | null;
  email: string | null;
  parent_role: ParentRole | null;
  avatar_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  business_role: BusinessRole | null;
  language: Language | null;
  theme: Theme | null;
  notify_email: boolean | null;
  notify_push: boolean | null;
  notify_sms: boolean | null;
  marketing_consent: boolean | null;
  account_status: AccountStatus | null;
  deletion_requested_at: string | null;
}

function mapProfileRow(data: RawProfileRow | null, fallbackEmail: string): ParentProfile {
  return {
    fullName: data?.full_name?.trim() || "",
    email: data?.email || fallbackEmail || "",
    parentRole: data?.parent_role ?? null,
    avatarUrl: data?.avatar_url ?? null,
    phone: data?.phone?.trim() || "",
    dateOfBirth: data?.date_of_birth ?? null,
    gender: data?.gender ?? null,
    businessRole: data?.business_role ?? null,
    language: data?.language ?? "it",
    theme: data?.theme ?? "light",
    notifyEmail: data?.notify_email ?? true,
    notifyPush: data?.notify_push ?? true,
    notifySms: data?.notify_sms ?? false,
    marketingConsent: data?.marketing_consent ?? false,
    accountStatus: data?.account_status ?? "active",
    deletionRequestedAt: data?.deletion_requested_at ?? null,
  };
}

// Profilo del genitore loggato — usato da app/(main)/profile e dalla Home.
export async function getParentProfile(): Promise<ParentProfile> {
  if (!isSupabaseConfigured) return DEMO_PROFILE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEMO_PROFILE;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  return mapProfileRow(data as RawProfileRow | null, user.email || "");
}

// Profilo personale del gestore centro loggato — usato da app/center/account.
// Stessa tabella/colonne di getParentProfile, solo un fallback demo diverso
// (un gestore, non un genitore) e senza "parentRole" (non pertinente).
export async function getGestoreAccountProfile(): Promise<ParentProfile> {
  const demoGestore: ParentProfile = {
    ...DEMO_PROFILE,
    fullName: "Marco Bianchi",
    email: "marco.bianchi@centrolido.it",
    parentRole: null,
    businessRole: "titolare",
  };
  if (!isSupabaseConfigured) return demoGestore;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return demoGestore;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  return mapProfileRow(data as RawProfileRow | null, user.email || "");
}

// Usata dalla Home: profilo "incompleto" solo per utenti reali che non hanno
// ancora inserito nome o ruolo — in demo è sempre false (profilo già "completo").
export async function isParentProfileIncomplete(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const profile = await getParentProfile();
  return !profile.fullName || !profile.parentRole;
}
