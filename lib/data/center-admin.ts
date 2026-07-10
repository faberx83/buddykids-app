// Contesto del Gestore centro loggato: quale centro gestisce (id reale +
// slug) ed eventuale ruolo Admin piattaforma (che vede/gestisce tutti i
// centri). In modalità demo replica il comportamento precedente basato su
// demoCenterAdminCenterId.

import { centers as mockCenters, demoCenterAdminCenterId } from "@/lib/mock-data";
import { Center } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface CenterContext {
  centerDbId: string | null; // uuid reale (colonna centers.id / profiles.center_id)
  centerSlug: string | null; // slug del centro — usato per filtrare Activity.centerId
  isPlatformAdmin: boolean;
}

export async function getCenterContext(): Promise<CenterContext> {
  if (!isSupabaseConfigured) {
    return { centerDbId: null, centerSlug: demoCenterAdminCenterId, isPlatformAdmin: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { centerDbId: null, centerSlug: null, isPlatformAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, center_id, centers ( slug )")
    .eq("id", user.id)
    .single();

  const center = firstOf(profile?.centers as { slug: string } | { slug: string }[] | null);

  return {
    centerDbId: profile?.center_id ?? null,
    centerSlug: center?.slug ?? null,
    isPlatformAdmin: profile?.role === "platform_admin",
  };
}

interface RawCenterRow {
  id: string;
  slug: string | null;
  name: string;
  emoji: string | null;
  gradient: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  social_links: unknown;
  has_bar: boolean | null;
  multiweek_discount_percent: number | null;
  family_discount_tiers: number[] | null;
  group_discount_tiers: { minKids: number; percent: number }[] | null;
  logo_url: string | null;
  cancellation_window_days: number | null;
}

function mapCenterRow(row: RawCenterRow): Center {
  return {
    id: row.slug || row.id,
    name: row.name,
    emoji: row.emoji || "🏫",
    gradient: row.gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
    city: row.city || "",
    address: row.address || "",
    lat: 45.4642,
    lng: 9.19,
    description: row.description || "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    ownerName: "",
    socialLinks: (row.social_links as Center["socialLinks"]) ?? undefined,
    hasBar: Boolean(row.has_bar),
    multiweekDiscountPercent: row.multiweek_discount_percent ?? undefined,
    familyDiscountTiers: row.family_discount_tiers ?? undefined,
    groupDiscountTiers: row.group_discount_tiers ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    cancellationWindowDays: row.cancellation_window_days ?? 3,
  };
}

export async function getMyCenter(): Promise<{ center: Center; dbId: string | null }> {
  const { centerDbId } = await getCenterContext();

  if (!isSupabaseConfigured || !centerDbId) {
    const fallback = mockCenters.find((c) => c.id === demoCenterAdminCenterId)!;
    return { center: fallback, dbId: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centers")
    .select(
      "id, slug, name, emoji, gradient, city, address, description, contact_email, contact_phone, social_links, has_bar, multiweek_discount_percent, family_discount_tiers, group_discount_tiers, logo_url, cancellation_window_days"
    )
    .eq("id", centerDbId)
    .single();

  if (error || !data) {
    const fallback = mockCenters.find((c) => c.id === demoCenterAdminCenterId)!;
    return { center: fallback, dbId: null };
  }

  return { center: mapCenterRow(data as RawCenterRow), dbId: (data as RawCenterRow).id };
}
