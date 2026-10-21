import FamigliaHubClient from "./FamigliaHubClient";
import FamigliaV2Client from "./FamigliaV2Client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getKidsForUser } from "@/lib/data/kids";
import { getFamilyForUser } from "@/lib/data/family";
import { getFamilyPeopleForParent } from "@/lib/data/family-people";
import { getParentAddresses } from "@/lib/data/addresses";
import { getKidSchoolProfilesForParent } from "@/lib/data/school-calendar";
import { getParentProfile } from "@/lib/data/profile";
import { getExternalPlannerItemsForParent } from "@/lib/data/external-planner-items";
import { PARENT_UX_FIX_FLAG } from "@/lib/nextgen/parent-ux-fix";

// SPRINT CORRETTIVO (Fabrizio: "facciamo hub card se ha senso anche sulle
// altre sezioni") — le 4 righe intere che prima stavano direttamente nel
// Profilo sotto l'header "Famiglia" (Indirizzi/Famiglia/Condivisione
// piano/Promemoria) sono spostate qui, dietro UN solo ingresso da Profilo.
//
// TRAMA — "LA TUA FAMIGLIA" (15/10/2026): con PROFILE_V2_ENABLED questa
// pagina diventa la casa della famiglia — figli, genitori (invito senza
// "Crea famiglia"), chi vi aiuta (nonni, tata e altre persone), luoghi.
// Senza il flag resta il vecchio hub "Famiglia e logistica", invariato.
export default async function FamigliaHubPage({
  searchParams,
}: {
  searchParams: Promise<{ addKid?: string; code?: string; scuola?: string }>;
}) {
  if (!isSupabaseConfigured) return <FamigliaHubClient />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <FamigliaHubClient />;

  const flag = (flagName: string) =>
    resolveFeatureFlag({ flagName, userId: user.id, role: "parent", tenant: "family", correlationId: generateCorrelationId() }).catch(
      () => false
    );
  const [v2, schoolCalendarEnabled, weeklyRoutineEnabled, externalEnabled, placeSearchEnabled, uxFix] = await Promise.all([
    flag("PROFILE_V2_ENABLED"),
    flag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED"),
    flag("WEEKLY_ROUTINE_ENABLED"),
    flag("EXTERNAL_PLANNER_ITEMS_ENABLED"),
    flag("PLACE_SEARCH_ENABLED"),
    // Correzioni dal test UX (21/10/2026).
    flag(PARENT_UX_FIX_FLAG),
  ]);
  if (!v2) return <FamigliaHubClient />;

  const [params, kids, family, people, addresses, profile, profileRow] = await Promise.all([
    searchParams,
    getKidsForUser(),
    getFamilyForUser(),
    getFamilyPeopleForParent(),
    getParentAddresses(),
    getParentProfile(),
    supabase.from("profiles").select("city").eq("id", user.id).maybeSingle(),
  ]);
  const schoolProfiles = schoolCalendarEnabled ? await getKidSchoolProfilesForParent(kids.map((k) => k.id)) : {};
  // 21/10/2026 — settimana tipo: orario della scuola per figlio (impegni ricorrenti "scuola").
  const schoolItems =
    weeklyRoutineEnabled && externalEnabled
      ? (await getExternalPlannerItemsForParent().catch(() => []))
          .filter((i) => i.isSchool)
          .map((i) => ({
            id: i.id,
            title: i.title,
            location: i.location,
            place: i.place,
            kidIds: i.kidIds,
            startTime: i.startTime,
            endTime: i.endTime,
            recurrence: i.recurrence,
          }))
      : null;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

  return (
    <FamigliaV2Client
      kids={kids}
      autoOpenAddKid={params.addKid === "1"}
      // Correzioni dal test UX (21/10/2026): "Imposta per Giulia" → scheda aperta sulla scuola.
      autoOpenSchoolKidId={params.scuola && kids.some((k) => k.id === params.scuola) ? params.scuola : null}
      initialJoinCode={!family && params.code ? params.code.toUpperCase().slice(0, 12) : null}
      schoolCalendarEnabled={schoolCalendarEnabled}
      schoolProfiles={schoolProfiles}
      residenceCity={(profileRow.data?.city as string | undefined) ?? null}
      family={family}
      myName={profile.fullName}
      myEmail={profile.email}
      people={people}
      addresses={addresses}
      schoolItems={schoolItems}
      todayIso={todayIso}
      placeSearchEnabled={placeSearchEnabled}
      uxFix={uxFix}
    />
  );
}
