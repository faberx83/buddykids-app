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
  // FIX (TRAMA FINAL HARDENING §10-12, segnalazione Fabrizio 04/09/2026 —
  // badge "Registro presenze" con un numero ma pagina "Nessun partecipante
  // trovato"): questa funzione leggeva SOLO booking_weeks — una prenotazione
  // "Giorni spot" (booking_days) non aveva MAI una riga qui, quindi non
  // compariva MAI nel roster del gestore, anche con un giorno accettato
  // proprio oggi (esattamente lo stesso gap già trovato e corretto lato
  // genitore in lib/data/checkin.ts#getTodayCheckinsForParent). weekId ora
  // è null per un gruppo "a giorno" — usare SEMPRE groupKey (mai
  // ricostruire "${activityId}:${weekId}" a mano) per identificare un
  // gruppo in modo univoco indipendentemente dal tipo.
  weekId: string | null;
  // Valorizzato SOLO per un gruppo "a giorno" (Giorni spot) — id della riga
  // activity_days, MAI insieme a weekId (esattamente come TodayCheckin in
  // checkin.ts: mai entrambi valorizzati).
  activityDayId?: string | null;
  // true per un gruppo "a giorno": la UI deve disabilitare la spunta
  // presenza (attendance_records richiede week_id NOT NULL finché
  // supabase/migration_35_attendance_day_based.sql non è applicata — questo
  // gruppo esiste solo per rendere VISIBILE chi è atteso oggi, non ancora
  // per registrarne la presenza).
  isDayBased?: boolean;
  // Chiave univoca stabile per questo gruppo, indipendente dal tipo
  // (settimana intera o giorno spot) — SEMPRE usarla per selezione/lookup
  // lato client invece di ricostruire una chiave da weekId (che per i
  // gruppi "a giorno" è null).
  groupKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  kids: AttendanceKid[];
  // Vero se la data ODIERNA rientra in questa settimana — usato dal client
  // per selezionare di default la settimana giusta invece della prima in
  // ordine alfabetico/data (segnalazione di Fabrizio: il check-in del
  // genitore non si vedeva perché il gestore si trovava di default su una
  // settimana diversa da quella di oggi) e per mostrare un indicatore
  // "Oggi" nella sidebar. Sempre true per un gruppo "a giorno" (esiste solo
  // per oggi, vedi sopra).
  isCurrentWeek: boolean;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawBookingRow {
  id: string;
  status: string;
  // FIX (TRAMA FINAL HARDENING §10-12) — vedi guardia nel loop
  // booking_weeks sotto: senza questo campo, una prenotazione a settimana
  // intera ANCORA "pending" (il centro non ha ancora risposto) compariva
  // comunque nel Registro presenze, come se fosse già un partecipante
  // confermato — stesso difetto concettuale già corretto in
  // lib/data/checkin.ts#getTodayCheckinsForParent.
  partner_decision: string;
  activity_id: string;
  activities: { id: string; name: string } | { id: string; name: string }[] | null;
  profiles: { id: string; full_name: string | null; email: string | null; phone: string | null } | { id: string; full_name: string | null; email: string | null; phone: string | null }[] | null;
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: {
    week_id: string;
    activity_weeks: { id: string; label: string; start_date: string; end_date: string } | { id: string; label: string; start_date: string; end_date: string }[] | null;
  }[] | null;
  // FIX (TRAMA FINAL HARDENING §10-12) — vedi commento su AttendanceWeekGroup
  // sopra: senza questo campo, una prenotazione "Giorni spot" non produceva
  // MAI un gruppo, quindi non compariva mai nel roster del gestore.
  booking_days: {
    partner_decision: string;
    activity_days: { id: string; date: string } | { id: string; date: string }[] | null;
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
      "id, status, partner_decision, activity_id, activities ( id, name ), profiles ( id, full_name, email, phone ), booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( week_id, activity_weeks ( id, label, start_date, end_date ) ), booking_days ( partner_decision, activity_days ( id, date ) )"
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
      // FIX (TRAMA FINAL HARDENING §10-12) — vedi commento su RawBookingRow
      // sopra: una prenotazione ancora "pending" non è un partecipante
      // confermato, non deve apparire nel Registro presenze (che invece resta
      // il posto giusto per le richieste ancora da decidere è l'Inbox
      // prenotazioni, /center/prenotazioni — non questa vista).
      if (booking.partner_decision !== "accepted") continue;
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;

      const key = `${activity.id}:week:${week.id}`;
      if (!groupsMap.has(key)) {
        const canonicalWeek = seasonWeeks.find((sw) =>
          overlaps(week.start_date, week.end_date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
        );
        groupsMap.set(key, {
          activityId: activity.id,
          activityName: activity.name,
          weekId: week.id,
          groupKey: key,
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

    // FIX (TRAMA FINAL HARDENING §10-12) — gruppo "a giorno" per una
    // prenotazione Giorni spot con un giorno che cade OGGI: mostrato SOLO
    // se il centro lo ha REALMENTE accettato (booking_days.partner_decision
    // === "accepted", stessa regola canonica già usata da
    // getTodayCheckinsForParent — un giorno pending/rifiutato/in lista
    // d'attesa non è un impegno confermato, niente roster per qualcosa che
    // potrebbe non esserci). Limitato a OGGI (non tutta la stagione, a
    // differenza dei gruppi a settimana): è il "Registro presenze"
    // operativo del giorno, coerente con isChildExpectedToday richiesto
    // dalla spec — il browsing storico/futuro per Giorni spot resta un
    // gap noto, riportato nel report finale.
    for (const bd of booking.booking_days ?? []) {
      if (bd.partner_decision !== "accepted") continue;
      const day = firstOf(bd.activity_days);
      if (!day || day.date !== todayIso) continue;

      const key = `${activity.id}:day:${day.id}`;
      if (!groupsMap.has(key)) {
        const canonicalWeek = seasonWeeks.find((sw) =>
          overlaps(day.date, day.date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
        );
        groupsMap.set(key, {
          activityId: activity.id,
          activityName: activity.name,
          weekId: null,
          activityDayId: day.id,
          isDayBased: true,
          groupKey: key,
          weekLabel: canonicalWeek ? `Settimana ${canonicalWeek.index} · Giorno spot` : `Giorno spot`,
          startDate: day.date,
          endDate: day.date,
          kids: [],
          isCurrentWeek: true, // per costruzione: esiste solo per oggi
        });
      }
      const dayGroup = groupsMap.get(key)!;

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        if (dayGroup.kids.some((k) => k.kidId === kid.id)) continue;

        dayGroup.kids.push({
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

// TRAMA FINAL HARDENING CLOSURE §16 (04/09/2026) — controparte "a giorno"
// di getAttendanceForWeek sopra, ora possibile perché
// supabase/migration_35_attendance_day_based.sql risulta APPLICATA (
// verificato via MCP Supabase read-only: attendance_records.activity_day_id/
// occurrence_id esistono, week_id è nullable). Prima di questa wave un
// gruppo "a giorno" riceveva sempre [] qui (vedi app/center/attendance/
// page.tsx), quindi anche un vero check-in del genitore già scritto in DB
// (checked_in_by='parent') non veniva mai mostrato al gestore — root cause
// della segnalazione live "il pallino c'è ma il Registro è vuoto".
export async function getAttendanceForDay(activityDayId: string): Promise<AttendanceDayStatus[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("kid_id, date, status, checked_in_by")
    .eq("activity_day_id", activityDayId);

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

export interface UnconfirmedCheckinsSignal {
  count: number;
  // Timestamp più recente tra i check-in ancora da confermare — usato dal
  // notification center Partner (31/08/2026) per ordinare/etichettare
  // l'unica notifica aggregata "Check-in da confermare" (nessuna riga
  // attendance_records ha un vero "checked_in_at" dedicato: updated_at è il
  // proxy più vicino disponibile nello schema esistente, aggiornato proprio
  // dal check-in del genitore). null se non ce ne sono.
  mostRecentAt: string | null;
}

// Stessa identica logica/scoping di getUnconfirmedParentCheckinsCount sopra
// (duplicato qui invece di refactored: nessuna delle due funzioni deve
// dipendere dall'altra, stesso pattern già presente in questo file — vedi
// getOpenInquiriesCountForCenter/getUnreadCountForCenter in
// lib/data/inquiries.ts che ridondano allo stesso modo), ma restituisce
// anche il timestamp più recente: la sola COUNT non basta per costruire un
// NotificationItem (serve relevantAt).
export async function getUnconfirmedCheckinsSignal(): Promise<UnconfirmedCheckinsSignal> {
  if (!isSupabaseConfigured) return { count: 0, mostRecentAt: null };

  const { centerDbId, isPlatformAdmin } = await getCenterContext();
  if (!centerDbId && !isPlatformAdmin) return { count: 0, mostRecentAt: null };

  const supabase = await createClient();

  let activityIds: string[] | null = null;
  if (centerDbId) {
    const { data: acts } = await supabase.from("activities").select("id").eq("center_id", centerDbId);
    activityIds = (acts ?? []).map((a) => a.id as string);
    if (activityIds.length === 0) return { count: 0, mostRecentAt: null };
  }

  let query = supabase
    .from("attendance_records")
    .select("updated_at")
    .eq("checked_in_by", "parent")
    .order("updated_at", { ascending: false });

  if (activityIds) query = query.in("activity_id", activityIds);

  const { data, error } = await query;
  if (error || !data) return { count: 0, mostRecentAt: null };
  return { count: data.length, mostRecentAt: data[0]?.updated_at ?? null };
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
