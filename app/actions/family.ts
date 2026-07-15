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
import { headers } from "next/headers";
import { sendEmail, isEmailConfigured } from "@/lib/email";

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

// ─────────────────────────────────────────────
// INVITO "VERO" VIA EMAIL (in aggiunta al codice — segnalato da Fabrizio:
// "il solo codice non è sufficiente"). Stesso pattern collaudato di
// app/actions/invites.ts (Gestore -> genitore): token univoco, invio email
// via lib/email.ts (Resend — se non configurato l'invito resta comunque
// creato e visibile come "in attesa", nessuna funzionalità bloccata), link
// che riusa ?next= già gestito da LoginForm.tsx per portare l'utente,
// loggato o dopo la registrazione, dritto al prompt di accettazione.
// ─────────────────────────────────────────────

async function buildOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildFamilyInviteEmailHtml(params: { familyName: string; inviterName: string; link: string }): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color:#1a2b3c;">
      <h2 style="margin: 0 0 12px;">Ciao,</h2>
      <p><b>${params.inviterName}</b> ti ha invitato a unirti alla famiglia <b>"${params.familyName}"</b> su TRAMA, per condividere indirizzi, organizzazione settimanale e piano attività dei bambini.</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="${params.link}" style="background:#6F63C5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; display:inline-block;">Accetta l'invito</a>
      </p>
      <p style="font-size:12px; color:#888;">Se il pulsante non funziona, apri questo link: ${params.link}</p>
    </div>
  `;
}

export interface InviteToFamilyResult {
  error?: string;
  emailSent?: boolean;
}

export async function inviteToFamilyAction(email: string): Promise<InviteToFamilyResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const invitedEmail = email.trim().toLowerCase();
  if (!invitedEmail || !invitedEmail.includes("@")) return { error: "Inserisci un'email valida" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Crea prima una famiglia" };
  if (membership.role !== "creatore" && membership.role !== "admin") {
    return { error: "Solo un admin della famiglia può invitare" };
  }

  if (user.email && user.email.toLowerCase() === invitedEmail) {
    return { error: "Non puoi invitare te stesso" };
  }

  const { data: family } = await supabase.from("families").select("name").eq("id", membership.family_id).single();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const token = crypto.randomUUID();
  const { data: invite, error } = await supabase
    .from("family_invites")
    .insert({
      family_id: membership.family_id,
      invited_email: invitedEmail,
      token,
      invited_by: user.id,
    })
    .select("id")
    .single();
  if (error || !invite) return { error: error?.message || "Errore nella creazione dell'invito" };

  const origin = await buildOrigin();
  const acceptPath = `/nextgen/planner/famiglia?accept=${token}`;
  const link = `${origin}/auth/login?next=${encodeURIComponent(acceptPath)}`;

  let emailSent = false;
  if (isEmailConfigured) {
    const html = buildFamilyInviteEmailHtml({
      familyName: family?.name || "la tua famiglia",
      inviterName: profile?.full_name || "Un genitore",
      link,
    });
    const sendResult = await sendEmail({
      to: invitedEmail,
      subject: `${profile?.full_name || "Un genitore"} ti invita su TRAMA 👨‍👩‍👧`,
      html,
    });
    if (!sendResult.error) {
      emailSent = true;
      await supabase.from("family_invites").update({ status: "sent", email_sent_at: new Date().toISOString() }).eq("id", invite.id);
    }
  }

  revalidatePath(PLANNER_FAMILY_PATH);
  return { emailSent };
}

export interface FamilyInvitePreview {
  familyName: string;
  inviterName: string | null;
  invitedEmail: string;
  valid: boolean;
}

// Chiamabile anche da non autenticati (arrivando dal link email prima del
// login/registrazione) — vedi get_family_invite_preview() security definer.
export async function getFamilyInvitePreviewAction(token: string): Promise<FamilyInvitePreview | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_family_invite_preview", { p_token: token }).maybeSingle();
  if (error || !data) return null;
  const row = data as { family_name: string; inviter_name: string | null; invited_email: string; valid: boolean };
  return {
    familyName: row.family_name,
    inviterName: row.inviter_name,
    invitedEmail: row.invited_email,
    valid: row.valid,
  };
}

export interface AcceptFamilyInviteResult {
  error?: string;
  familyName?: string;
}

export async function acceptFamilyInviteAction(token: string): Promise<AcceptFamilyInviteResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase.rpc("accept_family_invite", { p_token: token }).maybeSingle();
  if (error) return { error: error.message };
  const row = data as { family_id: string | null; family_name: string | null; error: string | null } | null;
  if (!row || row.error) return { error: row?.error || "Errore nell'accettazione dell'invito" };

  revalidatePath(PLANNER_FAMILY_PATH);
  return { familyName: row.family_name || undefined };
}
