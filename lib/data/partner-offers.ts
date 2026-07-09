// Fornitori consigliati per i gestori (tabella partner_offers) — lettura
// pubblica, scrittura riservata all'Admin piattaforma (RLS in schema.sql).
// Senza Supabase, o se la tabella è vuota, si torna alla lista statica in
// lib/partner-offers.ts (oggi vuota di proposito: nessun fornitore finto).

import { PartnerOffer, partnerOffers as mockOffers } from "@/lib/partner-offers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RawPartnerOfferRow {
  id: string;
  category: string;
  emoji: string | null;
  name: string;
  description: string | null;
  contact_label: string;
  contact_href: string;
  active: boolean | null;
  image_url: string | null;
}

function mapRow(row: RawPartnerOfferRow): PartnerOffer {
  return {
    id: row.id,
    category: row.category,
    emoji: row.emoji || "🤝",
    name: row.name,
    description: row.description || "",
    contactLabel: row.contact_label,
    contactHref: row.contact_href,
    imageUrl: row.image_url ?? undefined,
  };
}

// Vista Gestore: solo le offerte attive.
export async function getPartnerOffers(): Promise<PartnerOffer[]> {
  if (!isSupabaseConfigured) return mockOffers;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_offers")
    .select("id, category, emoji, name, description, contact_label, contact_href, active, image_url")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return mockOffers;
  return (data as RawPartnerOfferRow[]).map(mapRow);
}

export interface AdminPartnerOffer extends PartnerOffer {
  active: boolean;
}

// Vista Admin: tutte le offerte, incluse quelle disattivate.
export async function getAllPartnerOffersForAdmin(): Promise<AdminPartnerOffer[]> {
  if (!isSupabaseConfigured) return mockOffers.map((o) => ({ ...o, active: true }));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_offers")
    .select("id, category, emoji, name, description, contact_label, contact_href, active, image_url")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawPartnerOfferRow[]).map((row) => ({
    ...mapRow(row),
    active: row.active ?? true,
  }));
}
