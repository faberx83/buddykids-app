"use server";

// TRAMA — PORTALE CENTRI V2, ATTIVITÀ (28/10/2026, tavole 6 e 7): "Crea da
// modello" e "Duplica". Fabrizio: "dobbiamo rivedere tutto il portale in
// ordine e pronto per una prima condivisione con potenziali partner".
// Stesso percorso di createActivityAction (app/actions/center.ts): RLS del
// gestore, slug unico, log nello storico; differenze:
// - da modello: modalità a giorni singoli, orari e giorni della stagione già
//   pronti (lib/centers/activity-templates.ts) al posto delle 6 settimane di default;
// - duplica: copia la scheda (testi, luogo, età, prezzo, servizi, foto, tag),
//   NON copia giorni, settimane, prenotazioni, valutazioni: la copia nasce
//   senza date, e il portale lo dice ("mancano le date").

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";
import { logGestoreAction } from "@/lib/data/activity-log";
import { duplicateName, getTemplate, templateDates, weeklyFromDaily } from "@/lib/centers/activity-templates";

// Stessa regola di slugify in app/actions/center.ts (un file "use server" non
// può esportare funzioni sincrone, quindi non si importa da lì).
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "attivita"
  );
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function uniqueSlug(supabase: Supa, name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase.from("activities").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

function revalidateActivities() {
  revalidatePath("/center");
  revalidatePath("/center/activities");
  revalidatePath("/center/activities/[id]", "page");
  revalidatePath("/center/activities/[id]/calendar", "page");
}

/** Oggi a Roma, "YYYY-MM-DD". */
function romeToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

export interface TemplateActivityInput {
  templateKey: string;
  name: string;
  ageMin: number;
  ageMax: number;
  pricePerDay: number;
  capacity: number;
  hours: string;
  description: string;
}

export async function createActivityFromTemplateAction(
  input: TemplateActivityInput
): Promise<{ activitySlug?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Non disponibile in questo ambiente." };
  const template = getTemplate(input.templateKey);
  if (!template) return { error: "Modello non trovato." };
  const name = (input.name ?? "").trim();
  if (!name) return { error: "Scrivete il nome dell'attività." };
  const ageMin = Math.round(Number(input.ageMin));
  const ageMax = Math.round(Number(input.ageMax));
  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax > 18 || ageMin > ageMax) {
    return { error: "Controllate l'età: da quanti a quanti anni." };
  }
  const capacity = Math.round(Number(input.capacity));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) return { error: "I posti al giorno vanno da 1 a 500." };
  const pricePerDay = Number(input.pricePerDay);
  if (!Number.isFinite(pricePerDay) || pricePerDay < 0) return { error: "Il prezzo al giorno non è valido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: rientrate nel portale." };
  const { centerDbId } = await getCenterContext();
  if (!centerDbId) return { error: "Questo account non è ancora collegato a un centro: scriveteci rispondendo all'email di benvenuto." };

  const dates = templateDates(template.key, romeToday());
  if (dates.length === 0) return { error: "Per questo modello non ci sono più giorni in questa stagione." };

  const { data: center } = await supabase.from("centers").select("city, address").eq("id", centerDbId).maybeSingle();
  const slug = await uniqueSlug(supabase, name);
  const { data, error } = await supabase
    .from("activities")
    .insert({
      center_id: centerDbId,
      slug,
      name,
      emoji: template.emoji,
      age_min: ageMin,
      age_max: ageMax,
      price_per_week: weeklyFromDaily(pricePerDay),
      description: (input.description ?? "").trim() || template.description,
      booking_mode: "day_only",
      min_days_per_booking: 1,
      hours: (input.hours ?? "").trim() || template.hours,
      days: "",
      city: center?.city ?? null,
      address: center?.address ?? null,
    })
    .select("id, slug")
    .single();
  if (error || !data) return { error: "Non siamo riusciti a creare l'attività, riprovate." };

  const { error: daysError } = await supabase.from("activity_days").insert(
    dates.map((date) => ({
      activity_id: data.id,
      date,
      is_open: true,
      capacity,
      spots_left: capacity,
      single_day_bookable: true,
      discount_percent: null,
      last_minute: false,
      special_label: null,
      special_emoji: null,
    }))
  );

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: centerDbId,
    action: "activity_create",
    entityType: "activity",
    entityId: data.id,
    meta: { template: template.key, days: dates.length, ...(daysError ? { activityDaysError: daysError.message } : {}) },
  });

  revalidateActivities();
  return { activitySlug: data.slug };
}

// Colonne copiate dalla duplica (tutto ciò che descrive la scheda).
const DUPLICATE_COLUMNS = [
  "name",
  "emoji",
  "address",
  "city",
  "latitude",
  "longitude",
  "age_min",
  "age_max",
  "price_per_week",
  "shuttle_price",
  "description",
  "schedule",
  "meal_option",
  "pre_service",
  "post_service",
  "img_gradient",
  "days",
  "hours",
  "pills",
  "tags",
  "show_exact_spots",
  "cover_image_url",
  "gallery_urls",
  "dietary_options",
  "booking_mode",
  "min_days_per_booking",
  "meal_price_extra",
] as const;

export async function duplicateActivityAction(activitySlug: string): Promise<{ activitySlug?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Non disponibile in questo ambiente." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: rientrate nel portale." };
  const { centerDbId } = await getCenterContext();
  if (!centerDbId) return { error: "Questo account non è ancora collegato a un centro." };

  const { data: source } = await supabase
    .from("activities")
    .select(["id", "center_id", ...DUPLICATE_COLUMNS].join(", "))
    .eq("slug", activitySlug)
    .maybeSingle();
  const row = source as unknown as (Record<string, unknown> & { id: string; center_id: string; name: string }) | null;
  // Solo le attività del proprio centro (la RLS lo impedirebbe comunque).
  if (!row || row.center_id !== centerDbId) return { error: "Attività non trovata." };

  const copy: Record<string, unknown> = {};
  for (const col of DUPLICATE_COLUMNS) copy[col] = row[col];
  copy.name = duplicateName(String(row.name ?? ""));
  copy.center_id = centerDbId;
  copy.slug = await uniqueSlug(supabase, String(copy.name));

  const { data, error } = await supabase.from("activities").insert(copy).select("id, slug").single();
  if (error || !data) return { error: "Non siamo riusciti a duplicare l'attività, riprovate." };

  // Tag: best-effort, come il resto della scheda.
  const { data: tags } = await supabase.from("activity_tags").select("tag_id").eq("activity_id", row.id);
  if (tags && tags.length > 0) {
    await supabase.from("activity_tags").insert(tags.map((t: { tag_id: string }) => ({ activity_id: data.id, tag_id: t.tag_id })));
  }

  await logGestoreAction(supabase, {
    actorId: user.id,
    centerId: centerDbId,
    action: "activity_create",
    entityType: "activity",
    entityId: data.id,
    meta: { duplicatedFrom: row.id },
  });

  revalidateActivities();
  return { activitySlug: data.slug };
}
