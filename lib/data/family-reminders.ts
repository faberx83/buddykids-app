import "server-only";

// TRAMA — PROMEMORIA PER LE FAMIGLIE (15/10/2026). Parte I/O dei promemoria
// (la logica pura è in lib/nextgen/family-reminders.ts). Due ingressi:
//   - runFamilyReminders(): chiamata una volta al giorno dal cron già
//     esistente /api/cron/travel-reminders (piano Hobby: un giro al giorno,
//     ~17:00 ora legale / ~16:00 ora solare). Per ogni genitore con un
//     telefono registrato e FAMILY_REMINDERS_PUSH_ENABLED acceso: "Domani:
//     chi accompagna?" e "Scuola chiusa tra una settimana / dopodomani".
//   - notifyClassProposal(): quando qualcuno propone un'attività in "Classe e
//     scuola", avvisa le altre famiglie del gruppo (stesso flag, per
//     destinatario).
// Solo letture col client di servizio + sendPushToUser (che rispetta già
// notify_push). Nessuna tabella nuova, nessuna migrazione. Errori: mai
// rilanciati (una famiglia che fallisce non blocca le altre).

import { getClosureNotNeededForParent } from "@/lib/data/closure-not-needed";
import { notNeededCoverage } from "@/lib/nextgen/closure-not-needed";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { sendPushToUser } from "@/lib/push/send";
import { getKidClosureIntervalsForParent } from "@/lib/data/school-calendar";
import { buildFamilyReminders } from "@/lib/nextgen/family-reminders";
import { buildCoverage, listClosurePeriods } from "@/lib/nextgen/holiday-summary";
import { resolveResponsibleDisplay, type Moment, type ResponsibleValue, type Weekday } from "@/lib/nextgen/responsibility-options";
import type { ParentRole } from "@/lib/data/profile";

export const FAMILY_REMINDERS_FLAG = "FAMILY_REMINDERS_PUSH_ENABLED";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;
type One<T> = T | T[] | null;
const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function flagOnFor(userId: string, flagName: string): Promise<boolean> {
  return resolveFeatureFlag({ flagName, userId, role: "parent", tenant: "family" }).catch(() => false);
}

interface RawBooking {
  id: string;
  status: string;
  activities: One<{ id: string; name: string | null; hours: string | null; booking_mode: string | null; centers: One<{ name: string | null }> }>;
  partner_decision: string | null;
  booking_kids: { kid_id: string }[] | null;
  booking_weeks: { activity_weeks: One<{ start_date: string; end_date: string }> }[] | null;
  booking_days: { activity_days: One<{ date: string }> }[] | null;
}

// 20/10/2026: esportata e arricchita (nomi, orari, luoghi) per il buongiorno
// di TRAMA (lib/data/daily-briefing.ts): i promemoria serali usano gli stessi
// dati, i campi in più non cambiano nulla per loro.
export async function loadFamily(service: Service, parentId: string, todayIso: string) {
  const [externalOn, schoolOn] = await Promise.all([
    flagOnFor(parentId, "EXTERNAL_PLANNER_ITEMS_ENABLED"),
    flagOnFor(parentId, "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED"),
  ]);
  const [kidsRes, profileRes, bookingsRes, respRes, externalRes] = await Promise.all([
    service.from("kids").select("id, name").eq("parent_id", parentId),
    service.from("profiles").select("parent_role").eq("id", parentId).maybeSingle(),
    service
      .from("bookings")
      .select(
        "id, status, partner_decision, activities ( id, name, hours, booking_mode, centers ( name ) ), booking_kids ( kid_id ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( activity_days ( date ) )"
      )
      .eq("parent_id", parentId)
      .neq("status", "cancelled"),
    service
      .from("week_responsibilities")
      .select("kid_id, week_start_date, weekday, moment, responsible, responsible_label")
      .eq("parent_id", parentId),
    externalOn
      ? service
          .from("external_planner_items")
          .select("id, title, location, source_type, start_date, end_date, all_day, start_time, end_time, external_planner_item_kids ( kid_id )")
          .eq("parent_id", parentId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const kids = (kidsRes.data ?? []) as { id: string; name: string }[];
  const kidNameById: Record<string, string> = Object.fromEntries(kids.map((k) => [k.id, k.name]));
  const parentRole = ((profileRes.data as { parent_role?: ParentRole | null } | null)?.parent_role ?? null) as ParentRole | null;

  const hoursByActivityDbId: Record<string, string | undefined> = {};
  const bookings = ((bookingsRes.data ?? []) as unknown as RawBooking[]).map((b) => {
    const kidIds = (b.booking_kids ?? []).map((k) => k.kid_id);
    const activity = first(b.activities);
    if (activity?.id && activity.hours) hoursByActivityDbId[activity.id] = activity.hours;
    const dayDates = (b.booking_days ?? []).map((d) => first(d.activity_days)?.date).filter((d): d is string => Boolean(d));
    return {
      id: b.id,
      activityName: activity?.name ?? "Attività",
      activityDbId: activity?.id ?? null,
      centerName: first(activity?.centers ?? null)?.name ?? "",
      isDayBased: dayDates.length > 0,
      status: b.status,
      partnerDecision: b.partner_decision ?? "pending",
      kidIds,
      kidNames: kidIds.map((id) => kidNameById[id] ?? ""),
      weeks: (b.booking_weeks ?? [])
        .map((w) => first(w.activity_weeks))
        .filter((w): w is { start_date: string; end_date: string } => Boolean(w))
        .map((w) => ({ startDate: w.start_date, endDate: w.end_date })),
      dayDates,
    };
  });

  const externalItems = (
    (externalRes.data ?? []) as {
      id: string;
      title: string | null;
      location: string | null;
      source_type: string | null;
      start_date: string;
      end_date: string;
      all_day: boolean;
      start_time: string | null;
      end_time: string | null;
      external_planner_item_kids: { kid_id: string }[] | null;
    }[]
  ).map((i) => ({
    id: i.id,
    title: i.title ?? "Impegno",
    location: i.location,
    sourceType: i.source_type ?? "manual",
    startDate: i.start_date,
    endDate: i.end_date,
    allDay: i.all_day,
    startTime: i.start_time,
    endTime: i.end_time,
    kidIds: (i.external_planner_item_kids ?? []).map((k) => k.kid_id),
  }));

  const responsibilities = (
    (respRes.data ?? []) as {
      kid_id: string;
      week_start_date: string;
      weekday: string;
      moment: string;
      responsible: string;
      responsible_label: string | null;
    }[]
  ).map((r) => ({
    kidId: r.kid_id,
    weekStartDate: r.week_start_date,
    weekday: r.weekday as Weekday,
    moment: r.moment as Moment,
    responsible: r.responsible as ResponsibleValue,
    responsibleLabel: r.responsible_label,
  }));

  const closureData = schoolOn
    ? await getKidClosureIntervalsForParent(
        kids.map((k) => k.id),
        // client di servizio: stessa API del client utente, senza RLS
        { client: service as never, userId: parentId }
      ).catch(() => ({ hasAnySchoolProfile: false, closuresByKid: [] }))
    : { hasAnySchoolProfile: false, closuresByKid: [] };

  const closureNotNeeded = schoolOn ? await getClosureNotNeededForParent(service, parentId) : [];

  return {
    todayIso,
    parentRole,
    hoursByActivityDbId,
    bookings,
    externalItems,
    responsibilities,
    kidNameById,
    labelFor: (r: (typeof responsibilities)[number]) => resolveResponsibleDisplay(r, parentRole).label,
    closurePeriods: listClosurePeriods(closureData.closuresByKid, todayIso),
    // 20/10/2026 — i "Non serve" sulle chiusure contano come copertura.
    coverage: [...buildCoverage({ bookings, externalItems }), ...notNeededCoverage(closureNotNeeded)],
  };
}

export async function runFamilyReminders(service: Service, todayIso: string): Promise<{ parents: number; enabled: number; sent: number }> {
  const { data } = await service.from("push_subscriptions").select("user_id");
  const parentIds = Array.from(new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
  let enabled = 0;
  let sent = 0;
  for (const parentId of parentIds) {
    try {
      if (!(await flagOnFor(parentId, FAMILY_REMINDERS_FLAG))) continue;
      enabled++;
      const family = await loadFamily(service, parentId, todayIso);
      if (Object.keys(family.kidNameById).length === 0) continue; // account centro o famiglia senza figli
      for (const r of buildFamilyReminders(family)) {
        await sendPushToUser(parentId, { title: r.title, body: r.body, deepLink: r.deepLink });
        sent++;
      }
    } catch (err) {
      console.error("[family-reminders] famiglia saltata:", err instanceof Error ? err.message : String(err));
    }
  }
  try {
    await service.from("product_events").insert({
      event_name: "family_reminders_cron_run",
      detail: `parents=${parentIds.length} enabled=${enabled} sent=${sent}`,
    });
  } catch {
    // osservabilità best-effort: mai bloccare il cron
  }
  return { parents: parentIds.length, enabled, sent };
}

/** "Classe e scuola": nuova proposta → le altre famiglie del gruppo (fire-and-forget). */
export async function notifyClassProposal(input: { communityId: string; activityDbId: string; proposerId: string }): Promise<void> {
  try {
    const service = createServiceClient();
    if (!service) return;
    const [communityRes, membersRes, activityRes] = await Promise.all([
      service.from("communities").select("name").eq("id", input.communityId).maybeSingle(),
      service.from("community_members").select("parent_id").eq("community_id", input.communityId),
      service.from("activities").select("name").eq("id", input.activityDbId).maybeSingle(),
    ]);
    const communityName = (communityRes.data as { name?: string } | null)?.name ?? "Classe e scuola";
    const activityName = (activityRes.data as { name?: string } | null)?.name ?? "un'attività";
    const recipients = ((membersRes.data ?? []) as { parent_id: string }[])
      .map((m) => m.parent_id)
      .filter((id) => id !== input.proposerId);
    let notified = 0;
    for (const parentId of recipients) {
      if (!(await flagOnFor(parentId, FAMILY_REMINDERS_FLAG))) continue;
      await sendPushToUser(parentId, {
        title: `Nuova proposta in ${communityName}`,
        body: `${activityName}: ti interessa? Dillo agli altri genitori.`,
        deepLink: `/nextgen/community/${input.communityId}`,
      });
      notified++;
    }
    if (notified > 0) {
      await service.from("product_events").insert({ event_name: "class_proposal_push_sent", detail: `recipients=${notified}` });
    }
  } catch (err) {
    console.error("[family-reminders] proposta non notificata:", err instanceof Error ? err.message : String(err));
  }
}
