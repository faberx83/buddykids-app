// Partecipanti + registro presenze per il Gestore centro — mostra, per ogni
// attività e settimana di camp, i bambini iscritti (con nome reale genitore e
// contatto: richiede le policy RLS aggiuntive di migration_06, che espongono
// "kids"/"profiles" al centro solo per le proprie prenotazioni) più, quando
// presente, il "Gruppo" (funzionalità genitori) a cui il bambino appartiene
// per quell'attività — utile al gestore come riferimento in più, non
// sostituisce la settimana come criterio principale di raggruppamento.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterContext } from "@/lib/data/center-admin";

export interface AttendanceKid {
  kidId: string;
  kidName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  groupName: string | null;
}

export interface AttendanceWeekGroup {
  activityId: string;
  activityName: string;
  weekId: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  kids: AttendanceKid[];
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawBookingRow {
  id: string;
  status: string;
  activity_id: string;
  activities: { id: string; name: string } | { id: string; name: string }[] | null;
  profiles: { id: string; full_name: string | null; email: string | null; phone: string | null } | { id: string; full_name: string | null; email: string | null; phone: string | null }[] | null;
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: {
    week_id: string;
    activity_weeks: { id: string; label: string; start_date: string; end_date: string } | { id: string; label: string; start_date: string; end_date: string }[] | null;
  }[] | null;
}

export async function getParticipantsForCenter(): Promise<AttendanceWeekGroup[]> {
  if (!isSupabaseConfigured) return [];

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return [];

  const supabase = await createClient();

  // 1) Attività del centro (per un platform_admin senza centro proprio,
  // niente filtro esplicito: la RLS su "bookings" già gli concede tutto).
  let activityIds: string[] | null = null;
  if (centerDbId) {
    const { data: acts } = await supabase.from("activities").select("id").eq("center_id", centerDbId);
    activityIds = (acts ?? []).map((a) => a.id as string);
    if (activityIds.length === 0) return [];
  }

  let query = supabase
    .from("bookings")
    .select(
      "id, status, activity_id, activities ( id, name ), profiles ( id, full_name, email, phone ), booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( week_id, activity_weeks ( id, label, start_date, end_date ) )"
    )
    .neq("status", "cancelled");

  if (activityIds) query = query.in("activity_id", activityIds);

  const { data, error } = await query;
  if (error || !data) return [];

  // 2) Gruppo (facoltativo) per bambino+attività — best effort: se la query
  // fallisce (es. RLS non ancora applicata) i badge gruppo restano vuoti,
  // senza bloccare il resto della lista partecipanti.
  const groupNameByKidActivity = new Map<string, string>();
  try {
    const idsForGroups = activityIds ?? Array.from(new Set((data as RawBookingRow[]).map((b) => b.activity_id)));
    if (idsForGroups.length > 0) {
      const { data: groupRows } = await supabase
        .from("group_kids")
        .select("kid_id, groups ( name, activity_id )")
        .in("groups.activity_id", idsForGroups);
      for (const row of groupRows ?? []) {
        const group = firstOf(row.groups as { name: string; activity_id: string } | { name: string; activity_id: string }[] | null);
        if (group) groupNameByKidActivity.set(`${row.kid_id}:${group.activity_id}`, group.name);
      }
    }
  } catch {
    // best effort — vedi commento sopra
  }

  const groupsMap = new Map<string, AttendanceWeekGroup>();

  for (const booking of data as RawBookingRow[]) {
    const activity = firstOf(booking.activities);
    const parent = firstOf(booking.profiles);
    if (!activity) continue;

    for (const bw of booking.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;

      const key = `${activity.id}:${week.id}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          activityId: activity.id,
          activityName: activity.name,
          weekId: week.id,
          weekLabel: week.label,
          startDate: week.start_date,
          endDate: week.end_date,
          kids: [],
        });
      }
      const weekGroup = groupsMap.get(key)!;

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        if (weekGroup.kids.some((k) => k.kidId === kid.id)) continue; // evita duplicati se più prenotazioni

        weekGroup.kids.push({
          kidId: kid.id,
          kidName: kid.name,
          parentName: parent?.full_name || "",
          parentEmail: parent?.email || "",
          parentPhone: parent?.phone || "",
          groupName: groupNameByKidActivity.get(`${kid.id}:${activity.id}`) ?? null,
        });
      }
    }
  }

  return Array.from(groupsMap.values()).sort(
    (a, b) => a.activityName.localeCompare(b.activityName) || a.startDate.localeCompare(b.startDate)
  );
}

export interface AttendanceDayStatus {
  kidId: string;
  date: string;
  status: "presente" | "assente";
}

// Presenze già registrate per una specifica settimana (tutti i giorni),
// indicizzate per rapido lookup lato client.
export async function getAttendanceForWeek(weekId: string): Promise<AttendanceDayStatus[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("kid_id, date, status")
    .eq("week_id", weekId);

  if (error || !data) return [];
  return data.map((r) => ({ kidId: r.kid_id as string, date: r.date as string, status: r.status as "presente" | "assente" }));
}

// Elenco dei giorni (lun-ven) coperti da una settimana, per costruire le
// colonne dell'appello — usa direttamente le date reali di activity_weeks
// (non ricalcola la griglia stagionale: ogni attività può avere le proprie).
export function daysInWeek(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
