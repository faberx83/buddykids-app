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
import { getSeasonWeekRanges, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

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
  // Vero se la data ODIERNA rientra in questa settimana — usato dal client
  // per selezionare di default la settimana giusta invece della prima in
  // ordine alfabetico/data (segnalazione di Fabrizio: il check-in del
  // genitore non si vedeva perché il gestore si trovava di default su una
  // settimana diversa da quella di oggi) e per mostrare un indicatore
  // "Oggi" nella sidebar.
  isCurrentWeek: boolean;
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

  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: il check-in del genitore
  // "non si aggiorna lato gestore") — il vero problema era che questo
  // "Settimana N" veniva preso dal testo grezzo salvato su activity_weeks
  // (potenzialmente scritto a mano dal gestore, incoerente), esattamente
  // come il bug già trovato+corretto in lib/data/checkin.ts. Il gestore
  // vedeva quindi un'etichetta diversa da quella usata da Home/Planner per
  // la STESSA settimana reale, e finiva per selezionare a mano la
  // settimana sbagliata (quella che sembrava "quella giusta" per nome, ma
  // in realtà copriva date diverse da quelle del check-in). Ricalcoliamo
  // l'indice canonico dalla data reale, come planner.ts/checkin.ts.
  const seasonYear = await getSeasonYear();
  const seasonWeeks = getSeasonWeekRanges(seasonYear);
  const todayIso = new Date().toISOString().slice(0, 10);

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
        const canonicalWeek = seasonWeeks.find((sw) =>
          overlaps(week.start_date, week.end_date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
        );
        groupsMap.set(key, {
          activityId: activity.id,
          activityName: activity.name,
          weekId: week.id,
          weekLabel: canonicalWeek ? `Settimana ${canonicalWeek.index}` : week.label,
          startDate: week.start_date,
          endDate: week.end_date,
          kids: [],
          isCurrentWeek: todayIso >= week.start_date && todayIso <= week.end_date,
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

export type AttendanceStatusValue = "presente" | "assente" | "in_ritardo";

export interface AttendanceDayStatus {
  kidId: string;
  date: string;
  status: AttendanceStatusValue;
  // true se l'ULTIMA scrittura è stata il check-in del genitore (Home,
  // vedi app/actions/checkin.ts) e non ancora confermata/corretta dal
  // gestore — usato da AttendanceClient per mostrare un badge "segnalato
  // dal genitore".
  checkedInByParent: boolean;
}

// Presenze già registrate per una specifica settimana (tutti i giorni),
// indicizzate per rapido lookup lato client.
export async function getAttendanceForWeek(weekId: string): Promise<AttendanceDayStatus[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("kid_id, date, status, checked_in_by")
    .eq("week_id", weekId);

  if (error || !data) return [];
  return data.map((r) => ({
    kidId: r.kid_id as string,
    date: r.date as string,
    status: r.status as AttendanceStatusValue,
    checkedInByParent: r.checked_in_by === "parent",
  }));
}

// Conteggio dei check-in fatti dal genitore (Home) e non ancora
// confermati/corretti dal gestore — badge di notifica nel nav "Registro
// presenze" (Fabrizio: "ci vuole il badge delle notifiche come sulle
// richieste su tutte le sezioni che prevedono una notifica da una parte
// all'altra"). Un record resta "da confermare" finché il gestore non tocca
// esplicitamente lo stato (setAttendanceAction rimette checked_in_by a
// "center", vedi app/actions/attendance.ts).
export async function getUnconfirmedParentCheckinsCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return 0;

  const supabase = await createClient();

  let activityIds: string[] | null = null;
  if (centerDbId) {
    const { data: acts } = await supabase.from("activities").select("id").eq("center_id", centerDbId);
    activityIds = (acts ?? []).map((a) => a.id as string);
    if (activityIds.length === 0) return 0;
  }

  let query = supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("checked_in_by", "parent");

  if (activityIds) query = query.in("activity_id", activityIds);

  const { count, error } = await query;
  if (error || count === null) return 0;
  return count;
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
