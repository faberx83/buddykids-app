// Livello di accesso ai dati per le attività — legge da Supabase quando è
// collegato e ci sono righe reali (seminate con supabase/seed.sql), altrimenti
// usa i dati mock come rete di sicurezza (anche a Supabase configurato, così
// non si rompe nulla finché non hai eseguito il seed).

import { Activity, Promotion } from "@/lib/types";
import { activities as mockActivities, promotions as mockPromotions } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, isoDate, overlaps } from "@/lib/season-weeks";

const SELECT_COLUMNS = `
  id, slug, name, emoji, address, latitude, longitude, age_min, age_max,
  price_per_week, shuttle_price, description, schedule, meal_option, dietary_options,
  pre_service, post_service, rating, reviews_count, img_gradient, days, hours,
  distance_km, spots_left, show_exact_spots, weeks_available, pills, badges, center_id,
  cover_image_url, gallery_urls,
  centers ( slug, name, emoji, gradient, has_bar, accessible, accessible_note, multiweek_discount_percent, family_discount_tiers, group_discount_tiers ),
  activity_tags ( tag_id )
`;

interface RawCenterRef {
  slug: string | null;
  name: string | null;
  emoji: string | null;
  gradient: string | null;
  has_bar: boolean | null;
  accessible: boolean | null;
  accessible_note: string | null;
  multiweek_discount_percent: number | null;
  family_discount_tiers: number[] | null;
  group_discount_tiers: { minKids: number; percent: number }[] | null;
}

interface RawActivityRow {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  age_min: number | null;
  age_max: number | null;
  price_per_week: number | null;
  shuttle_price: number | null;
  description: string | null;
  schedule: unknown;
  meal_option: string | null;
  dietary_options: string[] | null;
  pre_service: unknown;
  post_service: unknown;
  rating: number | null;
  reviews_count: number | null;
  img_gradient: string | null;
  days: string | null;
  hours: string | null;
  distance_km: number | null;
  spots_left: number | null;
  show_exact_spots: boolean | null;
  weeks_available: string | null;
  pills: unknown;
  badges: unknown;
  center_id: string;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  centers: RawCenterRef | RawCenterRef[] | null;
  activity_tags: { tag_id: string }[] | null;
}

export function mapRow(row: RawActivityRow): Activity {
  const center = Array.isArray(row.centers) ? row.centers[0] : row.centers;
  const tagIds = Array.isArray(row.activity_tags)
    ? row.activity_tags.map((t) => t.tag_id)
    : [];

  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    emoji: row.emoji,
    imgGradient: row.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
    centerId: center?.slug || row.center_id,
    center: center?.name || "",
    tagIds,
    address: row.address || "",
    lat: row.latitude ?? undefined,
    lng: row.longitude ?? undefined,
    rating: Number(row.rating ?? 0),
    reviewsCount: row.reviews_count ?? 0,
    distanceKm: Number(row.distance_km ?? 0),
    ageRange: `${row.age_min ?? "?"}-${row.age_max ?? "?"} anni`,
    days: row.days ?? undefined,
    hours: row.hours ?? undefined,
    pricePerWeek: Number(row.price_per_week ?? 0),
    tags: (row.pills as Activity["tags"]) ?? [],
    badges: (row.badges as Activity["badges"]) ?? [],
    spotsLeft: row.spots_left ?? undefined,
    showExactSpots: Boolean(row.show_exact_spots),
    description: row.description || "",
    schedule: (row.schedule as Activity["schedule"]) ?? [],
    weeksAvailable: row.weeks_available || "",
    shuttlePrice: Number(row.shuttle_price ?? 0),
    reviews: [], // le recensioni reali arrivano allo Step 4 (dettaglio attività)
    preService: (row.pre_service as Activity["preService"]) ?? undefined,
    postService: (row.post_service as Activity["postService"]) ?? undefined,
    mealOption: (row.meal_option as Activity["mealOption"]) ?? undefined,
    dietaryOptions: row.dietary_options ?? undefined,
    centerHasBar: Boolean(center?.has_bar),
    centerAccessible: Boolean(center?.accessible),
    centerAccessibleNote: center?.accessible_note ?? undefined,
    centerMultiweekDiscountPercent: center?.multiweek_discount_percent ?? undefined,
    centerFamilyDiscountTiers: center?.family_discount_tiers ?? undefined,
    centerGroupDiscountTiers: center?.group_discount_tiers ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    galleryUrls: row.gallery_urls ?? undefined,
  };
}

export async function getActivities(): Promise<Activity[]> {
  if (!isSupabaseConfigured) return mockActivities;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    // Nessun dato reale ancora (seed non eseguito) o errore: non rompiamo
    // l'app, mostriamo comunque i dati demo.
    return mockActivities;
  }

  return data.map(mapRow);
}

// Per ciascuna delle 13 settimane stagionali (chiave: data ISO di inizio
// settimana), gli id (activities.id, cioè Activity.dbId) delle attività con
// ALMENO un activity_week con posti liberi che si sovrappone a quella
// settimana. Serve al filtro Date di Cerca (SearchClient) — l'oggetto
// Activity ha solo uno "spotsLeft" aggregato, non per-settimana, quindi va
// interrogata "activity_weeks" a parte (stessa tabella usata da Prenotazione
// e dal Planner in Home).
export async function getActivityAvailabilityByWeek(seasonYear: number): Promise<Record<string, string[]>> {
  const ranges = getSeasonWeekRanges(seasonYear);
  const result: Record<string, string[]> = {};
  for (const r of ranges) result[isoDate(r.start)] = [];

  if (!isSupabaseConfigured) return result; // demo: nessuna attività ha un dbId da confrontare

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_weeks")
    .select("activity_id, start_date, end_date")
    .gt("spots_left", 0);

  if (error || !data) return result;

  for (const row of data as { activity_id: string; start_date: string; end_date: string }[]) {
    for (const r of ranges) {
      const startIso = isoDate(r.start);
      if (overlaps(startIso, isoDate(r.end), row.start_date, row.end_date)) {
        result[startIso].push(row.activity_id);
      }
    }
  }
  return result;
}

// Attività di UN centro specifico — usata dalla dashboard Gestore centro.
// `centerDbId` è l'uuid reale (colonna activities.center_id); se assente
// (demo, o centro non ancora assegnato) si torna ai dati mock filtrati per
// `centerSlugFallback` (il comportamento di prima).
export async function getActivitiesForCenter(
  centerDbId: string | null,
  centerSlugFallback?: string | null
): Promise<Activity[]> {
  if (!isSupabaseConfigured || !centerDbId) {
    const slug = centerSlugFallback ?? null;
    return slug ? mockActivities.filter((a) => a.centerId === slug) : [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(SELECT_COLUMNS)
    .eq("center_id", centerDbId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getActivityBySlug(slug: string): Promise<Activity | null> {
  if (!isSupabaseConfigured) {
    return mockActivities.find((a) => a.id === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return mockActivities.find((a) => a.id === slug) ?? null;
  }

  return mapRow(data);
}

interface RawPromotionRow {
  id: string;
  type: "day_discount" | "last_minute";
  label: string;
  discount_percent: number;
  day_of_week: number | null;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
}

export async function getPromotionsForActivity(activity: Activity): Promise<Promotion[]> {
  if (!isSupabaseConfigured || !activity.dbId) {
    return mockPromotions.filter((p) => p.activityId === activity.id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, type, label, discount_percent, day_of_week, valid_from, valid_to, active")
    .eq("activity_id", activity.dbId)
    .eq("active", true);

  if (error || !data) {
    return mockPromotions.filter((p) => p.activityId === activity.id);
  }

  return (data as RawPromotionRow[]).map((row) => ({
    id: row.id,
    activityId: activity.id,
    type: row.type,
    label: row.label,
    discountPercent: Number(row.discount_percent),
    dayOfWeek: row.day_of_week ?? undefined,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
    active: row.active,
  }));
}

// Tutte le promozioni (attive e in pausa) delle attività indicate — usata
// dalla dashboard Gestore centro per amministrare le promozioni.
export async function getPromotionsForActivities(activities: Activity[]): Promise<Promotion[]> {
  const dbIds = activities.filter((a) => a.dbId).map((a) => a.dbId as string);
  if (!isSupabaseConfigured || dbIds.length === 0) {
    const ids = activities.map((a) => a.id);
    return mockPromotions.filter((p) => ids.includes(p.activityId));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, activity_id, type, label, discount_percent, day_of_week, valid_from, valid_to, active")
    .in("activity_id", dbIds);

  if (error || !data) return [];

  const slugByDbId = new Map(activities.map((a) => [a.dbId, a.id]));

  return (data as (RawPromotionRow & { activity_id: string })[]).map((row) => ({
    id: row.id,
    activityId: slugByDbId.get(row.activity_id) || row.activity_id,
    type: row.type,
    label: row.label,
    discountPercent: Number(row.discount_percent),
    dayOfWeek: row.day_of_week ?? undefined,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
    active: row.active,
  }));
}
