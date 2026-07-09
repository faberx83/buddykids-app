// Inviti del Gestore a potenziali nuovi genitori, con codice promo a
// scadenza — vedi supabase/schema.sql (tabella "invites") per il modello
// completo e la logica di collegamento automatico alla registrazione.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type InviteStatus = "pending" | "sent" | "registered" | "redeemed" | "expired";

export interface InviteItem {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  inviteCode: string;
  promoDiscountPercent: number;
  promoExpiresAt: string | null; // ISO yyyy-mm-dd
  active: boolean;
  status: InviteStatus; // effettivo, tiene conto della scadenza (vedi sotto)
  emailSentAt: string | null;
  registeredAt: string | null;
  createdAt: string;
}

interface RawInviteRow {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  invite_code: string;
  promo_discount_percent: number | null;
  promo_expires_at: string | null;
  active: boolean | null;
  status: string | null;
  email_sent_at: string | null;
  registered_at: string | null;
  created_at: string;
}

const SELECT_COLUMNS =
  "id, contact_name, contact_email, contact_phone, invite_code, promo_discount_percent, promo_expires_at, active, status, email_sent_at, registered_at, created_at";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Lo stato "expired" non è scritto sul DB da nessun job periodico — lo
// deduciamo qui al volo dalla data di scadenza, così la UI è sempre corretta
// senza bisogno di un cron.
function effectiveStatus(row: RawInviteRow): InviteStatus {
  const raw = (row.status as InviteStatus) || "pending";
  if (raw === "registered" || raw === "redeemed") return raw;
  if (row.promo_expires_at && row.promo_expires_at < todayISO()) return "expired";
  return raw;
}

function mapRow(row: RawInviteRow): InviteItem {
  return {
    id: row.id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    inviteCode: row.invite_code,
    promoDiscountPercent: Number(row.promo_discount_percent ?? 0),
    promoExpiresAt: row.promo_expires_at,
    active: Boolean(row.active),
    status: effectiveStatus(row),
    emailSentAt: row.email_sent_at,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
  };
}

export async function getInvitesForCenter(centerDbId: string): Promise<InviteItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .select(SELECT_COLUMNS)
    .eq("center_id", centerDbId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawInviteRow[]).map(mapRow);
}

export interface EligibleInviteDiscount {
  inviteId: string;
  code: string;
  percent: number;
}

// Sconto invito ancora da usare per il genitore attualmente loggato (se
// esiste) — al massimo uno per genitore: viene consumato la prima volta che
// completa una prenotazione (vedi redeem_invite_discount() in schema.sql,
// chiamata da app/booking/[id]/actions.ts dopo la creazione della prenotazione).
export async function getEligibleInviteDiscount(): Promise<EligibleInviteDiscount | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("invites")
    .select("id, invite_code, promo_discount_percent, promo_expires_at, active")
    .eq("registered_parent_id", user.id)
    .is("discount_applied_at", null)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  if (data.promo_expires_at && data.promo_expires_at < todayISO()) return null;

  return {
    inviteId: data.id,
    code: data.invite_code,
    percent: Number(data.promo_discount_percent ?? 0),
  };
}

export interface InvitePreview {
  centerName: string;
  discountPercent: number;
  valid: boolean;
}

// Usata nella pagina di registrazione per mostrare "Hai uno sconto del X%
// offerto da [Centro]" quando si arriva da un link di invito (?invite=CODE),
// PRIMA di essere autenticati — passa dalla funzione RPC get_invite_preview
// (security definer) invece di leggere direttamente la tabella, così non
// serve una policy di lettura pubblica che esporrebbe i dati di contatto.
export async function getInvitePreview(code: string): Promise<InvitePreview | null> {
  if (!isSupabaseConfigured || !code) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_invite_preview", { p_code: code })
    .maybeSingle();

  if (error || !data) return null;

  return {
    centerName: (data as { center_name: string }).center_name ?? "questo centro",
    discountPercent: Number((data as { discount_percent: number }).discount_percent ?? 0),
    valid: Boolean((data as { valid: boolean }).valid),
  };
}
