import ProfileNextgenClient from "./ProfileNextgenClient";
import { getKidsForUser } from "@/lib/data/kids";
import { getParentProfile } from "@/lib/data/profile";
import { getUnreadRepliesCountForParent } from "@/lib/data/inquiries";
// TRAMA — SCHOOL CALENDAR UX REFINEMENT (§10-11, 14/09/2026): stesso
// resolver/pattern di app/(main)/profile/page.tsx (LEGACY) — vedi commento
// lì per il dettaglio, qui è la controparte NEXTGEN dello stesso identico
// principio.
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getKidSchoolProfilesForParent } from "@/lib/data/school-calendar";

// SPRINT 6 (NEXTGEN) — stessi data-loader del profilo LEGACY
// (app/(main)/profile/page.tsx), nessuna nuova query: solo un nuovo punto di
// ingresso NEXTGEN che passa gli stessi dati a un componente client
// ridisegnato (ProfileNextgenClient).
//
// NOTA (tradeoff accettato, stesso principio già in uso per il link
// "Prenotazioni" della bottom nav NEXTGEN): le pagine di destinazione delle
// card "Attività"/"Supporto"/"Impostazioni" qui sotto — Sicurezza/Preferenze/
// Privacy (ProfileSettingsSection), Le mie prenotazioni, Preferiti, Le
// presenze, Le mie richieste — sono ancora tutte LEGACY con
// <PageHeader backHref="/profile"> fisso: uscendo da una di esse il tasto
// Indietro riporta al profilo LEGACY invece che qui. Nessuna di queste
// pagine viene toccata in questo sprint (fuori scope) — un restyle è la
// naturale prossima opportunità (vedi riepilogo).
//
// SPRINT 7 (feedback Fabrizio: "Logistica e Famiglia non devono diventare
// una sezione ad hoc?") — Indirizzi/Famiglia/Condivisione piano sono ora
// vere sezioni "Famiglia" qui dentro (non più un hub separato raggiunto da
// un link in fondo al Planner): a differenza delle pagine LEGACY sopra,
// Indirizzi e Famiglia SONO pagine NEXTGEN (IndirizziClient.tsx/
// FamigliaClient.tsx) e il loro "indietro" torna correttamente qui. "Chi fa
// cosa" resta nel Calendario del Planner (si tocca ogni settimana, non è
// un'impostazione).
export default async function NextgenProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string; addKid?: string }>;
}) {
  const [profile, kids, params, unreadReplies] = await Promise.all([
    getParentProfile(),
    getKidsForUser(),
    searchParams,
    getUnreadRepliesCountForParent(),
  ]);

  // §30 "SCHOOL DARK RELEASE": stesso principio di app/(main)/profile/page.tsx
  // (LEGACY) — mai un default "acceso" lato client.
  let schoolCalendarEnabled = false;
  let schoolProfiles: Awaited<ReturnType<typeof getKidSchoolProfilesForParent>> = {};
  let residenceCity: string | null = null;
  // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C): stesso default
  // sicuro "false" di schoolCalendarEnabled — mai un fallback client-side
  // "acceso".
  let classicFallbackEnabled = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profileRow } = await supabase.from("profiles").select("role, city").eq("id", user.id).single();
      residenceCity = (profileRow?.city as string) ?? null;
      schoolCalendarEnabled = await resolveFeatureFlag({
        flagName: "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
        userId: user.id,
        role: (profileRow?.role as string) ?? "parent",
        tenant: "family",
        correlationId: generateCorrelationId(),
      });
      if (schoolCalendarEnabled) {
        schoolProfiles = await getKidSchoolProfilesForParent(kids.map((k) => k.id));
      }
      // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C): stesso
      // pattern esatto di schoolCalendarEnabled appena sopra — risoluzione
      // server-side, default sicuro false, nessun override globale mai
      // scritto da questo programma. Governa SOLO la visibilità della riga
      // "Torna alla versione classica" in Profilo, nessun'altra logica.
      classicFallbackEnabled = await resolveFeatureFlag({
        flagName: "NEXTGEN_CLASSIC_FALLBACK_ENABLED",
        userId: user.id,
        role: (profileRow?.role as string) ?? "parent",
        tenant: "family",
        correlationId: generateCorrelationId(),
      });
    }
  }

  return (
    <ProfileNextgenClient
      fullName={profile.fullName}
      email={profile.email}
      parentRole={profile.parentRole}
      avatarUrl={profile.avatarUrl}
      phone={profile.phone}
      dateOfBirth={profile.dateOfBirth}
      gender={profile.gender}
      kids={kids}
      unreadReplies={unreadReplies}
      autoOpenEdit={params.complete === "1"}
      autoOpenAddKid={params.addKid === "1"}
      schoolCalendarEnabled={schoolCalendarEnabled}
      schoolProfiles={schoolProfiles}
      residenceCity={residenceCity}
      classicFallbackEnabled={classicFallbackEnabled}
    />
  );
}
