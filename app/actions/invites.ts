"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext, getMyCenter } from "@/lib/data/center-admin";
import { getInvitePreview, InvitePreview } from "@/lib/data/invites";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { logGestoreAction } from "@/lib/data/activity-log";

// Wrapper "use server" per poter chiamare getInvitePreview() (lib/data,
// server-only) direttamente da un Client Component (LoginForm) — mostra lo
// sconto offerto quando si arriva da un link ?invite=CODICE, prima ancora
// di essere registrati.
export async function getInvitePreviewAction(code: string): Promise<InvitePreview | null> {
  return getInvitePreview(code);
}

export interface InviteContactInput {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CreateInviteInput extends InviteContactInput {
  promoDiscountPercent: number;
  promoExpiresAt?: string | null; // ISO yyyy-mm-dd, null = nessuna scadenza
}

export interface CreateInviteResult {
  error?: string;
  inviteCode?: string;
  inviteLink?: string;
  emailSent?: boolean;
}

// Niente 0/O/1/I — ambigui da leggere/dettare a voce quando il gestore manda
// il codice a mano (WhatsApp, telefono) invece che via email automatica.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

async function buildOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function expiresLabelIt(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function buildInviteEmailHtml(params: {
  centerName: string;
  discountPercent: number;
  expiresLabel: string;
  link: string;
  contactName?: string;
}): string {
  const greeting = params.contactName ? `Ciao ${params.contactName},` : "Ciao,";
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color:#1a2b3c;">
      <h2 style="margin: 0 0 12px;">${greeting}</h2>
      <p>${params.centerName} ti invita a scoprire <b>BuddyKids</b>, l'app per organizzare l'estate dei tuoi figli in pochi minuti.</p>
      <p style="background:#E3F5F1; border-radius:10px; padding:16px; font-size:15px; margin: 20px 0;">
        🎁 Hai uno sconto del <b>${params.discountPercent}%</b> sulla tua prima prenotazione${
    params.expiresLabel ? `, valido fino al ${params.expiresLabel}` : ""
  }.
      </p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="${params.link}" style="background:#1FA88E; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; display:inline-block;">Registrati su BuddyKids</a>
      </p>
      <p style="font-size:12px; color:#888;">Se il pulsante non funziona, apri questo link: ${params.link}</p>
    </div>
  `;
}

async function generateUniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `BK-${randomCode()}`;
    const { data } = await supabase.from("invites").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return code;
  }
  return `BK-${randomCode(8)}`; // fallback, collisione estremamente improbabile
}

export async function createInviteAction(input: CreateInviteInput): Promise<CreateInviteResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!input.contactEmail?.trim() && !input.contactPhone?.trim()) {
    return { error: "Inserisci almeno un'email o un numero di telefono" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { centerDbId } = await getCenterContext();
  if (!centerDbId) return { error: "Il tuo account non è ancora collegato a un centro" };

  const code = await generateUniqueCode(supabase);
  const { data, error } = await supabase
    .from("invites")
    .insert({
      center_id: centerDbId,
      created_by: user.id,
      contact_name: input.contactName?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      invite_code: code,
      promo_discount_percent: input.promoDiscountPercent,
      promo_expires_at: input.promoExpiresAt || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message || "Errore nella creazione dell'invito" };

  const origin = await buildOrigin();
  const inviteLink = `${origin}/auth/login?invite=${code}`;

  let emailSent = false;
  if (input.contactEmail?.trim() && isEmailConfigured) {
    const { center } = await getMyCenter();
    const html = buildInviteEmailHtml({
      centerName: center.name,
      discountPercent: input.promoDiscountPercent,
      expiresLabel: expiresLabelIt(input.promoExpiresAt),
      link: inviteLink,
      contactName: input.contactName,
    });
    const sendResult = await sendEmail({
      to: input.contactEmail.trim(),
      subject: `${center.name} ti invita su BuddyKids 🎉`,
      html,
    });
    if (!sendResult.error) {
      emailSent = true;
      await supabase
        .from("invites")
        .update({ status: "sent", email_sent_at: new Date().toISOString() })
        .eq("id", data.id);
    }
  }

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: centerDbId,
    action: "invite_create",
    entityType: "invite",
    entityId: data.id,
    meta: { emailSent },
  });

  return { inviteCode: code, inviteLink, emailSent };
}

export interface BulkInviteResult {
  error?: string;
  createdCount: number;
  emailSentCount: number;
  failedRows: string[];
}

// Usata sia dall'upload file (righe già parsate lato client) sia potenzialmente
// da altri ingressi bulk futuri — riusa createInviteAction riga per riga così
// la logica (codice, email, log) resta in un solo posto.
export async function createInvitesBulkAction(
  contacts: InviteContactInput[],
  promoDiscountPercent: number,
  promoExpiresAt?: string | null
): Promise<BulkInviteResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase non configurato", createdCount: 0, emailSentCount: 0, failedRows: [] };
  }

  let createdCount = 0;
  let emailSentCount = 0;
  const failedRows: string[] = [];

  for (const contact of contacts) {
    const result = await createInviteAction({ ...contact, promoDiscountPercent, promoExpiresAt });
    if (result.error) {
      failedRows.push(contact.contactEmail || contact.contactPhone || contact.contactName || "riga senza contatto valido");
    } else {
      createdCount += 1;
      if (result.emailSent) emailSentCount += 1;
    }
  }

  return { createdCount, emailSentCount, failedRows };
}

export async function toggleInviteActiveAction(id: string, active: boolean): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("invites").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  return {};
}
