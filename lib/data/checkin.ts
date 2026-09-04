// Check-in MVP lato genitore — trova, per l'utente loggato, i bambini che
// hanno una prenotazione attiva OGGI (data odierna dentro l'intervallo
// start_date/end_date della settimana di camp) così la Home può mostrare
// "[Bambino] è arrivato/a a [Attività]?" (vedi components/CheckinPrompt.tsx).
//
// Nessuna geolocalizzazione/notifica push automatica: il genitore conferma
// manualmente aprendo l'app (scelta di scope concordata con Fabrizio — la
// geolocalizzazione in background e le push affidabili richiederebbero
// un'infrastruttura non ancora presente in questo stack, specialmente su
// iOS/Safari).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, overlaps, type SeasonWeekRange } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

export type CheckinStatus = "presente" | "assente" | "in_ritardo";

export interface TodayCheckin {
  // TRAMA FINAL HARDENING §13-15 (push check-in, 04/09/2026) — necessario
  // per il cron cross-famiglia sotto (getPendingCheckinsForPushToday):
  // getTodayCheckinsForParent() lo scarta subito (già filtrato per un solo
  // utente), ma la query condivisa lo seleziona comunque per non duplicare
  // la logica di raggruppamento.
  parentId: string;
  activityId: string;
  activityName: string;
  activitySlug: string;
  activityEmoji: string;
  activityImgGradient: string;
  coverImageUrl: string | null;
  // Segnalazione Fabrizio 03/09/2026 ("non vedo la notifica di check-in"):
  // una prenotazione "Giorni spot" (booking_days) non ha mai una vera
  // activity_weeks — weekId è ora null in quel caso, activityDayId prende
  // il suo posto. MAI entrambi valorizzati (vedi supabase/migration_35_
  // attendance_day_based.sql, NON ANCORA applicata — finché non lo è,
  // questi record restano generati e mostrati in Home ma il salvataggio
  // fallisce in modo esplicito, vedi app/actions/checkin.ts).
  weekId: string | null;
  activityDayId: string | null;
  // Identificativo stabile e SEMPRE presente (weekId oppure activityDayId)
  // — usato come chiave di raggruppamento lato UI invece di weekId da solo,
  // così i componenti non devono distinguere i due casi per il semplice
  // scopo di avere una key/un identificativo univoco.
  checkinKey: string;
  weekLabel: string;
  kidId: string;
  kidName: string;
  date: string;
  status: CheckinStatus | null;
  checkedInByParent: boolean;
  // Timestamp della risposta del genitore (colonna attendance_records.checkin_at,
  // scritta solo da parentCheckinAction — vedi app/actions/checkin.ts). Resta
  // null finché il genitore non risponde, o se lo stato è stato scritto solo
  // dal gestore (checked_in_by "center") senza mai passare dal check-in.
  checkinAt: string | null;
}

// Segnalazione di Fabrizio ("dopo un tot va tolto il banner"): dopo la
// risposta il banner in Home non deve restare visibile per sempre (prima si
// riduceva solo a un chip compatto, ma restava lì tutto il giorno) — oltre
// questa soglia la card non viene più mostrata affatto. Chi non ha ancora
// risposto (checkinAt null) resta sempre visibile, indipendentemente dalla
// soglia.
export const CHECKIN_HIDE_AFTER_HOURS = 3;

// Pura (nessun I/O) per essere testabile senza Supabase: decide se una card
// di check-in va ancora mostrata in Home.
export function isCheckinStillVisible(
  item: Pick<TodayCheckin, "status" | "checkinAt">,
  now: Date = new Date()
): boolean {
  if (!item.status || !item.checkinAt) return true;
  const hoursSinceAnswer = (now.getTime() - new Date(item.checkinAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceAnswer < CHECKIN_HIDE_AFTER_HOURS;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Stessa funzione di lib/data/my-bookings.ts (non esportata da lì) — usata
// solo come fallback quando un giorno spot non ricade in nessuna
// "Settimana N" canonica (non dovrebbe capitare per un'attività
// configurata correttamente, ma tiene la label sempre leggibile).
function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

interface RawActivityRef {
  id: string;
  name: string;
  slug: string | null;
  emoji: string | null;
  img_gradient: string | null;
  cover_image_url: string | null;
}

interface RawWeekRef {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

interface RawDayRef {
  id: string;
  date: string;
}

interface RawBookingRow {
  parent_id: string;
  // FIX (TRAMA FINAL HARDENING §10-12) — vedi commento sul ramo booking_weeks
  // sotto: senza questo campo, una prenotazione a settimana intera ANCORA
  // "pending" (il centro non ha ancora risposto) produceva comunque una
  // card di check-in in Home, come se fosse già un impegno confermato.
  partner_decision: string;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: {
    activity_weeks: RawWeekRef | RawWeekRef[] | null;
  }[] | null;
  // Segnalazione Fabrizio 03/09/2026 — vedi commento su TodayCheckin sopra.
  booking_days: {
    partner_decision: string;
    activity_days: RawDayRef | RawDayRef[] | null;
  }[] | null;
}

// TRAMA FINAL HARDENING §13-15 (push check-in, 04/09/2026) — estratta da
// getTodayCheckinsForParent() SENZA modificarne la logica: stesso identico
// filtro "cosa conta come impegno confermato oggi" (partner_decision
// accepted, data odierna dentro l'intervallo), ora riusabile sia dal
// genitore (con client di sessione + filtro sul proprio parent_id) sia dal
// cron cross-famiglia sotto (con client di servizio, nessun filtro
// parent_id). Nessuna nuova regola di "finestra actionable" inventata —
// esattamente la stessa già in produzione per la card Home.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheckinQueryClient = SupabaseClient<any, "public", any>;

async function computeTodayCheckinsQuery(
  supabase: CheckinQueryClient,
  today: string,
  seasonWeeks: SeasonWeekRange[],
  parentIdFilter: string | null
): Promise<TodayCheckin[]> {
  let query = supabase
    .from("bookings")
    .select(
      "parent_id, partner_decision, activities ( id, name, slug, emoji, img_gradient, cover_image_url ), booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( activity_weeks ( id, label, start_date, end_date ) ), booking_days ( partner_decision, activity_days ( id, date ) )"
    )
    .neq("status", "cancelled");
  if (parentIdFilter) query = query.eq("parent_id", parentIdFilter);

  const { data, error } = await query;
  if (error || !data) return [];

  const map = new Map<string, TodayCheckin>();
  for (const booking of data as RawBookingRow[]) {
    const activity = firstOf(booking.activities);
    if (!activity) continue;

    for (const bw of booking.booking_weeks ?? []) {
      // FIX (TRAMA FINAL HARDENING §10-12, root cause audit — "must not
      // assume bookings.status, partnerDecision... are equivalenti"): il
      // filtro sopra guarda solo status !== 'cancelled', che include anche
      // una prenotazione ANCORA "pending" (il centro non ha ancora
      // risposto) — mostrarla come "[Bambino] è arrivato?" oggi sarebbe un
      // impegno non confermato spacciato per reale. Stessa regola già
      // corretta per i giorni spot subito sotto (partner_decision ===
      // "accepted"), qui semplicemente non era mai stata applicata al ramo
      // a settimana intera.
      if (booking.partner_decision !== "accepted") continue;
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      if (today < week.start_date || today > week.end_date) continue; // non è oggi la settimana di camp

      const canonicalWeek = seasonWeeks.find((sw) =>
        overlaps(week.start_date, week.end_date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
      );
      // Solo "Settimana N" (senza intervallo date): il chiamante (Home)
      // premette già "Questa settimana · ", ripetere anche le date qui
      // sarebbe ridondante ("Questa settimana · Settimana 6 · LUG 6-10").
      const weekLabel = canonicalWeek ? `Settimana ${canonicalWeek.index}` : week.label;

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        const key = `${kid.id}:week:${week.id}`;
        if (map.has(key)) continue;
        map.set(key, {
          parentId: booking.parent_id,
          activityId: activity.id,
          activityName: activity.name,
          activitySlug: activity.slug ?? activity.id,
          activityEmoji: activity.emoji || "🏫",
          activityImgGradient: activity.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
          coverImageUrl: activity.cover_image_url,
          weekId: week.id,
          activityDayId: null,
          checkinKey: week.id,
          weekLabel,
          kidId: kid.id,
          kidName: kid.name,
          date: today,
          status: null,
          checkedInByParent: false,
          checkinAt: null,
        });
      }
    }

    // Segnalazione Fabrizio 03/09/2026 ("non vedo la notifica di check-in",
    // Lino su "Prova FP" — booking_mode "mixed", nessuna activity_weeks che
    // copra oggi): il ramo sopra guarda SOLO booking_weeks, quindi una
    // prenotazione "Giorni spot" con un giorno accettato proprio oggi non
    // produceva mai una card di check-in. Solo giorni ACCETTATI dal centro
    // (un giorno ancora pending/rifiutato/in lista d'attesa non è un
    // impegno confermato — niente "è arrivato?" per qualcosa che potrebbe
    // non esserci).
    for (const bd of booking.booking_days ?? []) {
      if (bd.partner_decision !== "accepted") continue;
      const day = firstOf(bd.activity_days);
      if (!day || day.date !== today) continue;

      const canonicalWeek = seasonWeeks.find((sw) =>
        overlaps(day.date, day.date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
      );
      const weekLabel = canonicalWeek ? `Settimana ${canonicalWeek.index}` : formatDateShort(day.date);

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        const key = `${kid.id}:day:${day.id}`;
        if (map.has(key)) continue;
        map.set(key, {
          parentId: booking.parent_id,
          activityId: activity.id,
          activityName: activity.name,
          activitySlug: activity.slug ?? activity.id,
          activityEmoji: activity.emoji || "🏫",
          activityImgGradient: activity.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
          coverImageUrl: activity.cover_image_url,
          weekId: null,
          activityDayId: day.id,
          checkinKey: day.id,
          weekLabel,
          kidId: kid.id,
          kidName: kid.name,
          date: today,
          status: null,
          checkedInByParent: false,
          checkinAt: null,
        });
      }
    }
  }

  const results = Array.from(map.values());
  if (results.length === 0) return [];

  // NOTA (finché supabase/migration_35_attendance_day_based.sql non è
  // applicata): questa select guarda solo week_id — corretto anche per i
  // risultati "a giorno" costruiti sopra, perché senza quella migrazione
  // NESSUN record attendance_records può esistere con weekId null (il
  // vincolo NOT NULL blocca la scrittura, vedi app/actions/checkin.ts) —
  // quindi non c'è nulla da recuperare per loro, mai un falso match. Da
  // estendere con activity_day_id in una commit successiva SOLO dopo aver
  // confermato che la migrazione è stata applicata (stesso pattern già
  // usato per waitlisted_at in lib/data/center-bookings.ts).
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("kid_id, week_id, status, checked_in_by, checkin_at")
    .eq("date", today)
    .in(
      "kid_id",
      results.map((r) => r.kidId)
    );

  for (const rec of existing ?? []) {
    const match = results.find((r) => r.kidId === rec.kid_id && r.weekId === rec.week_id);
    if (match) {
      match.status = rec.status as CheckinStatus;
      match.checkedInByParent = rec.checked_in_by === "parent";
      match.checkinAt = (rec.checkin_at as string | null) ?? null;
    }
  }

  return results.filter((r) => isCheckinStillVisible(r));
}

export async function getTodayCheckinsForParent(): Promise<TodayCheckin[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);

  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: la card di check-in
  // mostrava "Settimana 3" mentre il Registro presenze/Planner per la
  // STESSA settimana mostravano "Settimana 6"): qui si usava il testo
  // "label" salvato sulla riga activity_weeks, che il gestore può aver
  // scritto a mano quando ha creato le settimane della sua attività — non è
  // detto corrisponda al numero "canonico" calcolato da getSeasonWeekRanges
  // (la stessa griglia lun-ven usata da Planner/Prenotazione/Registro). Ora
  // ricalcoliamo l'indice dalla data reale, come fa lib/data/planner.ts, così
  // il numero di settimana è sempre coerente in tutta l'app.
  const seasonYear = await getSeasonYear();
  const seasonWeeks = getSeasonWeekRanges(seasonYear);

  return computeTodayCheckinsQuery(supabase, today, seasonWeeks, user.id);
}

// TRAMA FINAL HARDENING §13-15 (push check-in, 04/09/2026) — controparte
// cross-famiglia di getTodayCheckinsForParent(), per il cron
// app/api/cron/checkin-reminders. STESSA identica query/filtro sopra (mai
// una nuova regola di "cosa è un impegno confermato oggi"), solo senza il
// filtro parent_id, con il client di servizio (nessuna sessione utente in
// un cron) — poi ristretta a status === null, cioè "il genitore non ha
// ancora risposto", lo stesso identico stato che in Home fa comparire la
// card grande di CheckinPrompt (non collassata). Non spinge una push a chi
// ha già risposto (anche se la card resta visibile in forma compatta per
// le 3 ore successive, vedi CHECKIN_HIDE_AFTER_HOURS/isCheckinStillVisible
// — quella soglia serve solo alla UI, non è un motivo per notificare).
//
// DEDUPLICA — stesso limite documentato già accettato per
// lib/notifications/availability-push.ts: nessuna nuova persistenza. La
// garanzia di "una sola push al giorno per genitore" si appoggia
// interamente sul fatto che questo cron gira al più 1 volta/giorno (limite
// del piano Vercel Hobby, già verificato con vercel.json/travel-reminders)
// e che la query è scoperta SOLO per "oggi" (date = today), quindi una
// nuova esecuzione domani interroga un giorno diverso per costruzione — non
// serve una tabella di log per evitare un doppio invio nello stesso giorno
// in condizioni normali. Gap residuo, identico a quello di
// availability-push: un ipotetico retry di Vercel della STESSA esecuzione
// cron potrebbe duplicare l'invio — nessun retry automatico esiste oggi su
// questo endpoint, rischio basso ma non escluso senza persistenza dedicata.
// Se in futuro servirà una garanzia più forte, lo stesso pattern già
// proposto per l'altra push (tabella con UNIQUE su parent_id+data) si
// applica identico qui — non introdotto ora, per la stessa regola
// "fermarsi prima della migration" già seguita altrove in questa wave.
//
// AUDIT PARTNER-SIDE (richiesto esplicitamente prima di aggiungere
// qualunque push): il centro NON deve mai "agire" dopo un check-in
// presente/assente — sono puramente informativi per il roster presenze
// (vedi lib/data/attendance-report.ts). L'unico caso realmente
// "actionable" per il centro è "in_ritardo", ed è GIÀ notificato via email
// in app/actions/checkin.ts (parentCheckinAction) da prima di questa wave
// — aggiungere anche una push Partner qui duplicherebbe un canale già
// esistente per lo stesso evento, non è un gap reale. Nessuna push
// Partner aggiunta: non è un'omissione, è una scelta di scope verificata.
export async function getPendingCheckinsForPushToday(
  service: CheckinQueryClient
): Promise<TodayCheckin[]> {
  const today = new Date().toISOString().slice(0, 10);
  const seasonYear = await getSeasonYear();
  const seasonWeeks = getSeasonWeekRanges(seasonYear);

  const all = await computeTodayCheckinsQuery(service, today, seasonWeeks, null);
  return all.filter((item) => item.status === null);
}
