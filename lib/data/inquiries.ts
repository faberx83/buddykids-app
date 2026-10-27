// Richieste dei genitori al Gestore ("Contatta il gestore" nella scheda
// attività) — ticketing semplice, vedi supabase/schema.sql#activity_inquiries.
// Due viste: quella del genitore (le proprie richieste, con eventuale
// risposta) e quella del centro (le richieste ricevute, da evadere).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";
import { threadMessages, type InquiryMessage, type InquirySide } from "@/lib/inquiries/thread";

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
  // "Letta" dal punto di vista del genitore — vero finché il centro non
  // risponde (poi torna false: c'è una risposta nuova da vedere). Segnalato
  // da Fabrizio: vuole un pallino/notifica quando arriva una risposta.
  readByParent: boolean;
  centerName?: string | null;
  // 27/10/2026 (conversazione): ultimo messaggio e sua data, per l'elenco.
  lastMessage?: InquiryMessage | null;
  lastMessageAt?: string;
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
  // "Letta" dal punto di vista del centro — falso per una richiesta nuova
  // non ancora aperta/segnata, vero dopo (anche prima di rispondere, se il
  // gestore la segna esplicitamente come letta).
  readByCenter: boolean;
  repliedAt?: string | null;
  lastMessage?: InquiryMessage | null;
  lastMessageAt?: string;
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
  read_by_parent: boolean;
  activities:
    | { slug: string; name: string; centers?: { name: string } | { name: string }[] | null }
    | { slug: string; name: string; centers?: { name: string } | { name: string }[] | null }[]
    | null;
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
    .select("id, message, status, reply, replied_at, created_at, read_by_parent, activities ( slug, name, centers ( name ) )")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = (data as RawParentRow[]).map((row) => {
    const activity = firstOf(row.activities);
    return {
      id: row.id,
      activityId: activity?.slug ?? "",
      activityName: activity?.name ?? "Attività",
      centerName: firstOf(activity?.centers ?? null)?.name ?? null,
      message: row.message,
      status: row.status,
      reply: row.reply,
      repliedAt: row.replied_at,
      createdAt: row.created_at,
      readByParent: row.read_by_parent,
    };
  });
  return withLastMessages(supabase, rows);
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

interface RawMessageRow {
  id: string;
  inquiry_id: string;
  author_side: InquirySide;
  body: string;
  created_at: string;
}

// 27/10/2026 (conversazione, migration_54): i messaggi di più conversazioni
// in una sola lettura. Tabella assente (migration non applicata) o errore →
// mappa vuota: si ricade sul ticket di prima (domanda + ultima risposta).
export async function readMessagesByInquiry(
  supabase: SupabaseLike,
  inquiryIds: string[]
): Promise<Map<string, InquiryMessage[]>> {
  const out = new Map<string, InquiryMessage[]>();
  if (inquiryIds.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("inquiry_messages")
      .select("id, inquiry_id, author_side, body, created_at")
      .in("inquiry_id", inquiryIds)
      .order("created_at", { ascending: true });
    if (error || !data) return out;
    for (const row of data as RawMessageRow[]) {
      const list = out.get(row.inquiry_id) ?? [];
      list.push({ id: row.id, side: row.author_side, body: row.body, createdAt: row.created_at });
      out.set(row.inquiry_id, list);
    }
  } catch {
    return out;
  }
  return out;
}

async function withLastMessages<
  T extends { id: string; message: string; reply: string | null; createdAt: string; repliedAt?: string | null }
>(supabase: SupabaseLike, rows: T[]): Promise<(T & { lastMessage: InquiryMessage | null; lastMessageAt: string })[]> {
  const byId = await readMessagesByInquiry(supabase, rows.map((r) => r.id));
  return rows
    .map((r) => {
      const msgs = threadMessages(
        { id: r.id, message: r.message, reply: r.reply, createdAt: r.createdAt, repliedAt: r.repliedAt ?? null },
        byId.get(r.id) ?? null
      );
      const last = msgs[msgs.length - 1] ?? null;
      return { ...r, lastMessage: last, lastMessageAt: last?.createdAt ?? r.createdAt };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export interface InquiryThread {
  id: string;
  activitySlug: string;
  activityName: string;
  activityDbId: string;
  counterpartName: string; // il centro (per la famiglia) o il genitore (per il centro)
  counterpartEmail: string | null;
  status: InquiryStatus;
  unread: boolean;
  messages: InquiryMessage[];
}

// Una conversazione, per chi la può vedere (RLS di activity_inquiries:
// il genitore le proprie, il centro quelle delle sue attività, l'Admin tutte).
export async function getInquiryThread(id: string, viewer: InquirySide): Promise<InquiryThread | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_inquiries")
    .select(
      "id, activity_id, message, status, reply, replied_at, created_at, read_by_parent, read_by_center, activities ( slug, name, centers ( name ) ), profiles!parent_id ( full_name, email )"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    id: string;
    activity_id: string;
    message: string;
    status: InquiryStatus;
    reply: string | null;
    replied_at: string | null;
    created_at: string;
    read_by_parent: boolean;
    read_by_center: boolean;
    activities:
      | { slug: string; name: string; centers: { name: string } | { name: string }[] | null }
      | { slug: string; name: string; centers: { name: string } | { name: string }[] | null }[]
      | null;
    profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
  };
  const activity = firstOf(row.activities);
  const center = firstOf(activity?.centers ?? null);
  const parent = firstOf(row.profiles);
  const byId = await readMessagesByInquiry(supabase, [row.id]);
  return {
    id: row.id,
    activitySlug: activity?.slug ?? "",
    activityName: activity?.name ?? "Attività",
    activityDbId: row.activity_id,
    counterpartName: viewer === "parent" ? center?.name ?? "Il centro" : parent?.full_name || "Genitore",
    counterpartEmail: viewer === "center" ? parent?.email ?? null : null,
    status: row.status,
    unread: viewer === "parent" ? !row.read_by_parent : !row.read_by_center,
    messages: threadMessages(
      { id: row.id, message: row.message, reply: row.reply, createdAt: row.created_at, repliedAt: row.replied_at },
      byId.get(row.id) ?? null
    ),
  };
}

// La conversazione aperta di questo genitore su questa attività, se c'è
// ("Contatta il gestore" riprende quella invece di aprirne un'altra).
export async function findOpenInquiryForActivity(
  supabase: SupabaseLike,
  parentId: string,
  activityDbId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("activity_inquiries")
    .select("id")
    .eq("parent_id", parentId)
    .eq("activity_id", activityDbId)
    .neq("status", "chiusa")
    .order("created_at", { ascending: false })
    .limit(1);
  return data && data.length > 0 ? (data[0].id as string) : null;
}

interface RawCenterRow {
  id: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  replied_at?: string | null;
  created_at: string;
  read_by_center: boolean;
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

  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: richiesta inviata dal
  // genitore visibile in "Le mie richieste" ma non in /center/richieste):
  // activity_inquiries ha DUE foreign key verso profiles (parent_id E
  // replied_by), quindi un embed "profiles ( ... )" senza indicazione era
  // ambiguo per PostgREST ("more than one relationship was found") — la
  // query falliva con errore, e "error || !data" lo trasformava in [] senza
  // segnalarlo. L'hint "!parent_id" indica esplicitamente quale FK seguire.
  let query = supabase
    .from("activity_inquiries")
    .select(
      "id, message, status, reply, replied_at, created_at, read_by_center, activities ( slug, name ), profiles!parent_id ( full_name, email )"
    )
    .order("created_at", { ascending: false });

  if (activityIds) query = query.in("activity_id", activityIds);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = (data as RawCenterRow[]).map((row) => {
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
      repliedAt: row.replied_at ?? null,
      createdAt: row.created_at,
      readByCenter: row.read_by_center,
    };
  });
  return withLastMessages(supabase, rows);
}

// Conteggio richieste ancora senza risposta (badge nella sidebar Gestore,
// stesso pattern del badge "Richieste Gruppo").
export async function getOpenInquiriesCountForCenter(): Promise<number> {
  const all = await getInquiriesForCenter();
  return all.filter((i) => i.status === "aperta").length;
}

// Conteggio richieste non lette dal centro (badge — segnalato da Fabrizio:
// "deve essere notificato... l'arrivo di un messaggio"). A differenza del
// conteggio sopra (basato sullo status), questo riflette anche una richiesta
// aperta che il gestore ha già visto/segnato come letta senza ancora
// rispondere: più preciso per un "hai qualcosa di nuovo da guardare?".
export async function getUnreadCountForCenter(): Promise<number> {
  const all = await getInquiriesForCenter();
  return all.filter((i) => !i.readByCenter).length;
}

// Conteggio risposte non lette dal genitore (badge lato genitore — stessa
// segnalazione di Fabrizio, ma sull'altro verso: quando il centro risponde
// il genitore deve accorgersene).
export async function getUnreadRepliesCountForParent(): Promise<number> {
  const all = await getInquiriesForParent();
  return all.filter((i) => !i.readByParent).length;
}
