// Certificazioni servizio (richiesta di Fabrizio): il gestore invia una
// richiesta con un'etichetta libera (es. "Istruttori certificati FISE per
// equitazione") ed eventuale documento di supporto, un Admin piattaforma
// approva/rifiuta, il genitore vede solo quelle approvate come badge nel
// dettaglio attività. Vedi supabase/schema.sql#activity_certifications per
// lo schema e le policy RLS (che fanno già la maggior parte del filtraggio
// qui sotto: un gestore non-admin che interroga tutte le righe vede comunque
// solo le proprie + quelle approvate di altri).

import { CertificationItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawRow {
  id: string;
  activity_id: string;
  label: string;
  status: "pending" | "approved" | "rejected";
  document_url: string | null;
  admin_note: string | null;
  created_at: string;
  activities: { name: string } | { name: string }[] | null;
  centers: { name: string } | { name: string }[] | null;
}

const SELECT_COLUMNS =
  "id, activity_id, label, status, document_url, admin_note, created_at, activities ( name ), centers ( name )";

function mapRow(row: RawRow): CertificationItem {
  return {
    id: row.id,
    activityId: row.activity_id,
    activityName: firstOf(row.activities)?.name || "",
    centerName: firstOf(row.centers)?.name || "",
    label: row.label,
    status: row.status,
    documentPath: row.document_url ?? undefined,
    adminNote: row.admin_note ?? undefined,
    createdAt: row.created_at,
  };
}

// Solo le certificazioni APPROVATE di un'attività — usata dal dettaglio
// attività lato genitore (badge pubblico, vedi DetailClient.tsx).
export async function getApprovedCertificationsForActivity(
  activityDbId: string | undefined
): Promise<CertificationItem[]> {
  if (!isSupabaseConfigured || !activityDbId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_certifications")
    .select(SELECT_COLUMNS)
    .eq("activity_id", activityDbId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as RawRow[]).map(mapRow);
}

// Tutte le richieste (qualunque stato) di un'attività — usata dalla scheda
// attività lato Gestore per mostrare lo storico delle proprie richieste.
export async function getCertificationsForActivityGestore(
  activityDbId: string | undefined
): Promise<CertificationItem[]> {
  if (!isSupabaseConfigured || !activityDbId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_certifications")
    .select(SELECT_COLUMNS)
    .eq("activity_id", activityDbId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawRow[]).map(mapRow);
}

// Tutte le richieste su tutti i centri — usata dalla coda di approvazione
// Admin (/admin/certifications). Le RLS lasciano passare tutte le righe solo
// se l'utente è davvero platform_admin.
export async function getAllCertificationsForAdmin(): Promise<CertificationItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_certifications")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as RawRow[]).map(mapRow);
}
