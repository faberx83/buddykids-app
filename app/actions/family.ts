"use server";

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: creazione/adesione
// (tramite codice invito — stesso pattern di app/actions/communities.ts) ed
// uscita dalla famiglia. Una volta nella stessa famiglia, i genitori
// condividono lettura/scrittura su Indirizzi/"Chi fa cosa?"/Condivisione
// Piano (RLS aggiornata in supabase/schema.sql) — bambini/prenotazioni
// restano invariati e solo-proprietario.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { escapeEmailHtml, tramaEmailHtml } from "@/lib/email-layout";
import { familyHost } from "@/lib/tenant";
import { defaultFamilyName } from "@/lib/nextgen/family-page-v2";
import { newShortInviteToken, shortInviteUrl } from "@/lib/public-links";

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

// BUGFIX (05/08, stesso bug trovato in app/actions/invites.ts): questa
// funzione copiava alla lettera l'header "host" della richiesta corrente —
// un invito Famiglia deve sempre atterrare sul tenant famiglia,
// indipendentemente da dove è stato generato. Vedi familyHost() in
// lib/tenant.ts.
async function buildOrigin(): Promise<string> {
  const h = await headers();
  const host = familyHost(h.get("host") || "localhost:3000");
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildFamilyInviteEmailHtml(params: { familyName: string; inviterName: string; link: string }): string {
  // 22/10/2026 (ritest): stessa forma delle altre email di TRAMA (lib/email-layout.ts).
  return tramaEmailHtml({
    title: "Organizziamoci insieme su TRAMA",
    paragraphs: [
      `<b>${escapeEmailHtml(params.inviterName)}</b> ti ha invitato nella famiglia <b>"${escapeEmailHtml(params.familyName)}"</b> su TRAMA: vedrete lo stesso Planner e potrete dividervi chi accompagna e chi ritira.`,
    ],
    cta: { label: "Accetta l'invito", href: params.link },
    showLinkFallback: true,
  });
}

export interface InviteToFamilyResult {
  error?: string;
  emailSent?: boolean;
  // Sempre restituito (anche se l'email parte con successo): Fabrizio vuole
  // poter mandare l'invito anche a mano, es. su WhatsApp, invece di dipendere
  // solo dalla consegna dell'email.
  link?: string;
  // 15/10/2026: quando l'invito per email non è disponibile (tabella
  // family_invites non ancora creata), si invita col codice della famiglia:
  // il link porta alla pagina "La tua famiglia" con il codice già pronto.
  inviteCode?: string;
}

/** Tabella mancante (migrazione non ancora applicata): PostgREST PGRST205 / Postgres 42P01. */
function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /schema cache|does not exist/i.test(err.message ?? "");
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

  // 16/10/2026 — token corto (12 caratteri) per un link leggibile:
  // https://tramapp.it/i/<token> (vedi lib/public-links.ts e app/i/[key]).
  const token = newShortInviteToken();
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
  if (error && isMissingTableError(error)) {
    // Ripiego: invito con il codice della famiglia (stessa adesione di
    // joinFamilyByCodeAction), mai un messaggio tecnico in inglese a schermo.
    const { data: fam } = await supabase.from("families").select("invite_code").eq("id", membership.family_id).single();
    if (!fam?.invite_code) return { error: "Non sono riuscito a preparare l'invito, riprova" };
    const origin = await buildOrigin();
    return {
      emailSent: false,
      inviteCode: fam.invite_code as string,
      link: shortInviteUrl(origin, fam.invite_code as string),
    };
  }
  if (error || !invite) return { error: "Non sono riuscito a preparare l'invito, riprova" };

  const origin = await buildOrigin();
  const link = shortInviteUrl(origin, token);

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
  return { emailSent, link };
}

// TRAMA — "LA TUA FAMIGLIA" (16/10/2026, Fabrizio: "la lista dei genitori deve
// essere modificabile, se voglio eliminare uno come faccio?"). Chi ha creato
// la famiglia (o un admin) può togliere un altro genitore e annullare un
// invito in attesa. Le policy RLS di family_members permettono di togliere
// solo sé stessi, quindi l'operazione passa dal client di servizio DOPO aver
// controllato qui, con il client dell'utente, che: chi chiede è creatore o
// admin; la persona è nella SUA famiglia; non è sé stesso; non è il creatore.
// (Alternativa valutata: nuove policy RLS → serviva una migrazione; questa
// strada non tocca il database. Stesso schema già usato in groups.ts.)
// I figli e le prenotazioni restano di chi li ha inseriti: chi viene tolto
// non vede più il Planner condiviso, chi resta non vede più i suoi figli.

async function requireFamilyAdmin() {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" as const };
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Non fai parte di una famiglia" as const };
  if (membership.role !== "creatore" && membership.role !== "admin") {
    return { error: "Solo chi ha creato la famiglia può farlo" as const };
  }
  return { user, familyId: membership.family_id as string };
}

export async function removeFamilyMemberAction(parentId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const ctx = await requireFamilyAdmin();
  if ("error" in ctx) return { error: ctx.error };
  if (!parentId || parentId === ctx.user.id) return { error: "Per uscire tu, usa \"Esci dalla famiglia\"" };

  const service = createServiceClient();
  if (!service) return { error: "Non sono riuscito a togliere il genitore, riprova" };
  const { data: target } = await service
    .from("family_members")
    .select("role")
    .eq("family_id", ctx.familyId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (!target) return { error: "Questa persona non è più nella tua famiglia" };
  if (target.role === "creatore") return { error: "Non puoi togliere chi ha creato la famiglia" };

  const { error } = await service.from("family_members").delete().eq("family_id", ctx.familyId).eq("parent_id", parentId);
  if (error) return { error: "Non sono riuscito a togliere il genitore, riprova" };
  revalidatePath("/nextgen/profile/famiglia");
  revalidatePath(PLANNER_FAMILY_PATH);
  return {};
}

export async function cancelFamilyInviteAction(inviteId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const ctx = await requireFamilyAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const service = createServiceClient();
  if (!service) return { error: "Non sono riuscito ad annullare l'invito, riprova" };
  const { data, error } = await service
    .from("family_invites")
    .update({ status: "expired" })
    .eq("id", inviteId)
    .eq("family_id", ctx.familyId)
    .in("status", ["pending", "sent"])
    .select("id");
  if (error) return { error: "Non sono riuscito ad annullare l'invito, riprova" };
  if (!data || data.length === 0) return { error: "Questo invito non è più in attesa" };
  revalidatePath("/nextgen/profile/famiglia");
  revalidatePath(PLANNER_FAMILY_PATH);
  return {};
}

// TRAMA — "LA TUA FAMIGLIA" (15/10/2026): invitare l'altro genitore senza il
// passaggio "Crea famiglia". Se il genitore non è ancora in un gruppo
// famiglia, lo si crea in automatico (nome dal cognome), poi stesso invito
// di inviteToFamilyAction (email + link da mandare a mano).
export async function inviteCoParentAction(email: string): Promise<InviteToFamilyResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Non autenticato" };
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!membership) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const created = await createFamilyAction(defaultFamilyName(profile?.full_name as string | null));
    if (created.error) return { error: created.error };
  }
  const res = await inviteToFamilyAction(email);
  revalidatePath("/nextgen/profile/famiglia");
  return res;
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
