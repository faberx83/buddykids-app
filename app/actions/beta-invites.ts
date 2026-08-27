"use server";

// Codici invito Beta (public.beta_invite_codes, migration_30_beta_invite_
// codes.sql) — CRUD Admin + anteprima pubblica per LoginForm.tsx (link
// ?beta=CODICE condiviso manualmente da Fabrizio, es. WhatsApp).
//
// RLS impone già is_platform_admin() su select/insert/update/delete (stesso
// principio di app/actions/feature-flag-overrides.ts): qui si usa sempre il
// client autenticato ordinario, MAI il service client — chi chiama senza
// essere Admin riceve un errore Postgres tradotto in messaggio leggibile.
// getBetaInvitePreviewAction() è l'unica eccezione: passa dalla funzione
// RPC security definer get_beta_invite_preview() (non da una query diretta
// sulla tabella), quindi funziona anche per un visitatore non autenticato.

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { familyHost } from "@/lib/tenant";

const ADMIN_PATH = "/admin/beta-invites";

// Stesso bugfix già applicato a app/actions/invites.ts#buildOrigin: chi crea
// il codice lo fa dal pannello Admin (admin.*), ma chi lo USA deve sempre
// atterrare sul tenant famiglia (mai su admin.*/partner.*) — vedi
// familyHost() in lib/tenant.ts, già usata da proxy.ts con lo stesso scopo.
async function buildFamilyOrigin(): Promise<string> {
  const h = await headers();
  const host = familyHost(h.get("host") || "localhost:3000");
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function friendlyError(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501" || error.message.includes("policy")) {
    return "Non hai i permessi di Admin piattaforma per gestire i codici invito Beta.";
  }
  if (error.message.includes("beta_invite_codes_code_key") || error.message.includes("duplicate key")) {
    return "Esiste già un codice invito con questo valore — scegline uno diverso.";
  }
  if (error.message.includes("chk_beta_invite_codes_max_redemptions")) {
    return "Il numero massimo di utilizzi deve essere maggiore di zero (lascia vuoto per illimitato).";
  }
  return error.message;
}

export interface BetaInvitePreview {
  valid: boolean;
  publicLabel: string | null;
}

// Chiamabile da un Client Component non autenticato (LoginForm) — mostra
// una piccola conferma "codice riconosciuto" quando si arriva da un link
// ?beta=CODICE, prima ancora di registrarsi.
export async function getBetaInvitePreviewAction(code: string): Promise<BetaInvitePreview | null> {
  if (!isSupabaseConfigured || !code.trim()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_beta_invite_preview", { p_code: code.trim() })
    .maybeSingle();

  if (error || !data) return null;

  return {
    valid: Boolean((data as { valid: boolean }).valid),
    publicLabel: (data as { public_label: string | null }).public_label ?? null,
  };
}

export interface CreateBetaInviteCodeInput {
  code: string;
  label: string | null;
  cohortKey: string;
  maxRedemptions: number | null;
  /** ISO 8601, null = nessuna scadenza. */
  expiresAt: string | null;
}

function normalizeCode(raw: string): string {
  // Stesso spirito del codice invito-sconto esistente (BK-XXXXXX): maiuscolo,
  // senza spazi ai bordi — un codice scritto/letto a voce su WhatsApp non
  // deve fallire per differenze di case.
  return raw.trim().toUpperCase();
}

export async function createBetaInviteCodeAction(
  input: CreateBetaInviteCodeInput
): Promise<{ error?: string; code?: string; inviteLink?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const code = normalizeCode(input.code);
  if (!code) return { error: "Il codice non può essere vuoto" };
  if (!input.cohortKey.trim()) return { error: "La cohort non può essere vuota" };
  if (input.maxRedemptions !== null && (!Number.isFinite(input.maxRedemptions) || input.maxRedemptions <= 0)) {
    return { error: "Il numero massimo di utilizzi deve essere maggiore di zero" };
  }
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    return { error: "Data di scadenza non valida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("beta_invite_codes").insert({
    code,
    label: input.label?.trim() || null,
    cohort_key: input.cohortKey.trim(),
    max_redemptions: input.maxRedemptions,
    expires_at: input.expiresAt,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath(ADMIN_PATH);
  const origin = await buildFamilyOrigin();
  return { code, inviteLink: `${origin}/auth/login?beta=${code}` };
}

export interface UpdateBetaInviteCodeInput {
  id: string;
  active: boolean;
  maxRedemptions: number | null;
  /** ISO 8601, null = nessuna scadenza. */
  expiresAt: string | null;
}

export async function updateBetaInviteCodeAction(input: UpdateBetaInviteCodeInput): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.maxRedemptions !== null && (!Number.isFinite(input.maxRedemptions) || input.maxRedemptions <= 0)) {
    return { error: "Il numero massimo di utilizzi deve essere maggiore di zero" };
  }
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    return { error: "Data di scadenza non valida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("beta_invite_codes")
    .update({
      active: input.active,
      max_redemptions: input.maxRedemptions,
      expires_at: input.expiresAt,
      updated_by: user.id,
    })
    .eq("id", input.id);

  if (error) return { error: friendlyError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function deleteBetaInviteCodeAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const { error } = await supabase.from("beta_invite_codes").delete().eq("id", id);

  if (error) return { error: friendlyError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}
