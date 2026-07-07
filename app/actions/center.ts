"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DayAvailability, MealOption, ServiceOption, SocialLinks } from "@/lib/types";
import { logGestoreAction } from "@/lib/data/activity-log";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ─────────────────────────────────────────────
// Calendario disponibilità (activity_days)
// ─────────────────────────────────────────────
export async function saveActivityDaysAction(
  activityDbId: string,
  days: DayAvailability[]
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const rows = days.map((d) => ({
    activity_id: activityDbId,
    date: d.date,
    is_open: d.isOpen,
    capacity: d.capacity,
    spots_left: d.spotsLeft,
    single_day_bookable: d.singleDayBookable,
    discount_percent: d.discountPercent ?? null,
    last_minute: d.lastMinute ?? false,
    special_label: d.specialLabel ?? null,
    special_emoji: d.specialEmoji ?? null,
  }));

  const { error } = await supabase
    .from("activity_days")
    .upsert(rows, { onConflict: "activity_id,date" });

  if (error) return { error: error.message };

  const { data: actRow } = await supabase
    .from("activities")
    .select("center_id")
    .eq("id", activityDbId)
    .single();

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: actRow?.center_id ?? null,
    action: "activity_days_save",
    entityType: "activity",
    entityId: activityDbId,
    meta: { daysCount: rows.length },
  });

  return {};
}

// ─────────────────────────────────────────────
// Scheda attività (activities + activity_tags)
// ─────────────────────────────────────────────
export interface ActivityUpdateInput {
  activityDbId: string;
  name: string;
  ageRange: string;
  pricePerWeek: number;
  shuttlePrice: number;
  description: string;
  spotsLeft: number;
  tagIds: string[];
  address: string;
  lat: number;
  lng: number;
  mealOption: MealOption;
  preService: ServiceOption;
  postService: ServiceOption;
  schedule: { time: string; label: string; color: string }[];
}

export async function updateActivityAction(input: ActivityUpdateInput): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const match = input.ageRange.match(/(\d+)\s*-\s*(\d+)/);
  const ageMin = match ? Number(match[1]) : null;
  const ageMax = match ? Number(match[2]) : null;

  const { data: beforeRow } = await supabase
    .from("activities")
    .select("center_id, price_per_week")
    .eq("id", input.activityDbId)
    .single();

  const { error } = await supabase
    .from("activities")
    .update({
      name: input.name,
      age_min: ageMin,
      age_max: ageMax,
      price_per_week: input.pricePerWeek,
      shuttle_price: input.shuttlePrice,
      description: input.description,
      spots_left: input.spotsLeft,
      address: input.address,
      latitude: input.lat,
      longitude: input.lng,
      meal_option: input.mealOption,
      pre_service: input.preService,
      post_service: input.postService,
      schedule: input.schedule,
    })
    .eq("id", input.activityDbId);

  if (error) return { error: error.message };

  // Ricostruisce i tag scelti: rimuove i vecchi e inserisce quelli attuali.
  const { error: delError } = await supabase
    .from("activity_tags")
    .delete()
    .eq("activity_id", input.activityDbId);
  if (delError) return { error: delError.message };

  if (input.tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("activity_tags")
      .insert(input.tagIds.map((tagId) => ({ activity_id: input.activityDbId, tag_id: tagId })));
    if (tagError) return { error: tagError.message };
  }

  const priceChanged = beforeRow ? Number(beforeRow.price_per_week) !== input.pricePerWeek : undefined;
  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: beforeRow?.center_id ?? null,
    action: "activity_update",
    entityType: "activity",
    entityId: input.activityDbId,
    meta: {
      priceChanged,
      oldPrice: beforeRow?.price_per_week ?? null,
      newPrice: input.pricePerWeek,
    },
  });

  return {};
}

// ─────────────────────────────────────────────
// Profilo centro (centers)
// ─────────────────────────────────────────────
export interface CenterProfileUpdateInput {
  centerDbId: string;
  name: string;
  city: string;
  address: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: SocialLinks;
}

export async function updateCenterProfileAction(
  input: CenterProfileUpdateInput
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("centers")
    .update({
      name: input.name,
      city: input.city,
      address: input.address,
      description: input.description,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      social_links: input.socialLinks,
    })
    .eq("id", input.centerDbId);

  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: input.centerDbId,
    action: "center_profile_update",
    entityType: "center",
    entityId: input.centerDbId,
  });

  return {};
}

// ─────────────────────────────────────────────
// Promozioni (promotions)
// ─────────────────────────────────────────────
export interface CreatePromotionInput {
  activityDbId: string;
  type: "day_discount" | "last_minute";
  label: string;
  discountPercent: number;
  dayOfWeek?: number;
}

export async function createPromotionAction(
  input: CreatePromotionInput
): Promise<{ promotionId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data, error } = await supabase
    .from("promotions")
    .insert({
      activity_id: input.activityDbId,
      type: input.type,
      label: input.label,
      discount_percent: input.discountPercent,
      day_of_week: input.type === "day_discount" ? input.dayOfWeek ?? null : null,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message || "Errore nella creazione della promozione" };

  const { data: actRow } = await supabase
    .from("activities")
    .select("center_id")
    .eq("id", input.activityDbId)
    .single();

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: actRow?.center_id ?? null,
    action: "promotion_create",
    entityType: "promotion",
    entityId: data.id,
    meta: { type: input.type, discountPercent: input.discountPercent },
  });

  return { promotionId: data.id };
}

async function centerIdForPromotion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  promotionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("promotions")
    .select("activities ( center_id )")
    .eq("id", promotionId)
    .single();
  const activity = firstOf(
    data?.activities as { center_id: string } | { center_id: string }[] | null
  );
  return activity?.center_id ?? null;
}

export async function togglePromotionAction(
  promotionId: string,
  active: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const centerId = await centerIdForPromotion(supabase, promotionId);
  const { error } = await supabase.from("promotions").update({ active }).eq("id", promotionId);
  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId,
    action: "promotion_toggle",
    entityType: "promotion",
    entityId: promotionId,
    meta: { active },
  });

  return {};
}

export async function deletePromotionAction(promotionId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const centerId = await centerIdForPromotion(supabase, promotionId);
  const { error } = await supabase.from("promotions").delete().eq("id", promotionId);
  if (error) return { error: error.message };

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId,
    action: "promotion_delete",
    entityType: "promotion",
    entityId: promotionId,
  });

  return {};
}
