// Richieste dei genitori al Gestore ("Contatta il gestore" nella scheda
// attività) — ticketing semplice, vedi supabase/schema.sql#activity_inquiries.
// Due viste: quella del genitore (le proprie richieste, con eventuale
// risposta) e quella del centro (le richieste ricevute, da evadere).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";

export type InquiryStatus = "aperta" | "risposta" | "chiusa";

export interface ParentInquiry {
  id: string;
  activityId: string; // slug, per il link alla scheda attività
  activityName: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface CenterInquiry {
  id: string;
  activityId: string; // slug
  activityName: string;
  parentName: string;
  parentEmail: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  createdAt: string;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawParentRow {
  id: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  activities: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

export async function getInquiriesForParent(): Promise<ParentInquiry[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("activity_inquiries")
    .select("id, message, status, reply, replied_at, created_at, activities ( slug, name )")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as RawParentRow[]).map((row) => {
    const activity = firstOf(row.activities);
    return {
      id: row.id,
      activityId: activity?.slug ?? "",
      activityName: activity?.name ?? "Attività",
      message: row.message,
      status: row.status,
      reply: row.reply,
      repliedAt: row.replied_at,
      createdAt: row.created_at,
    };
  });
}

interface RawCenterRow {
  id: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  created_at: string;
  activities: { slug: string; name: string } | { slug: string; name: string }[] | null;
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
}

// Richieste ricevute dal centro del Gestore loggato — usata da
// /center/richieste. Stesso pattern di lib/data/group-requests.ts
// (getCenterContext + filtro center_id, bypassato per un platform_admin).
export async function getInquiriesForCenter(): Promise<CenterInquiry[]> {
  if (!isSupabaseConfigured) return [];

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return [];

  const supabase = await createClient();

  let activityIds: string[] | null = null;
  if (centerDbId) {
    const { data: acts } = await supabase.from("activities").select("id").eq("center_id", centerDbId);
    activityIds = (acts ?? []).map((a) => a.id as string);
    if (activityIds.length === 0) return [];
  }

  let query = supabase
    .from("activity_inquiries")
    .select(
      "id, message, status, reply, created_at, activities ( slug, name ), profiles ( full_name, email )"
    )
    .order("created_at", { ascending: false });

  if (activityIds) query = query.in("activity_id", activityIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as RawCenterRow[]).map((row) => {
    const activity = firstOf(row.activities);
    const parent = firstOf(row.profiles);
    return {
      id: row.id,
      activityId: activity?.slug ?? "",
      activityName: activity?.name ?? "Attività",
      parentName: parent?.full_name || "Genitore",
      parentEmail: parent?.email || "",
      message: row.message,
      status: row.status,
      reply: row.reply,
      createdAt: row.created_at,
    };
  });
}

// Conteggio richieste ancora senza risposta (badge nella sidebar Gestore,
// stesso pattern del badge "Richieste Gruppo").
export async function getOpenInquiriesCountForCenter(): Promise<number> {
  const all = await getInquiriesForCenter();
  return all.filter((i) => i.status === "aperta").length;
}
