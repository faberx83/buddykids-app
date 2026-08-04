import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import WalkthroughRestartButton from "@/components/WalkthroughRestartButton";
import { getGestoreAccountProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getTutorialDefinition } from "@/lib/walkthrough/registry";

// Sotto-pagina dedicata "Preferenze" — stessa struttura del profilo genitore,
// include anche le notifiche (unite qui su richiesta di Fabrizio).
export default async function GestorePreferenzePage() {
  const profile = await getGestoreAccountProfile();

  // Visual Acceptance Gate (§15, DEC-70) — Fabrizio ha chiesto se il tour si
  // può riaccendere dalle impostazioni: sì, da qui. Stesso gating usato in
  // app/center/layout.tsx per lo Spotlight stesso (TRAMA_ONE_ENABLED) — un
  // bottone per riavviare un percorso che l'utente non vedrà mai (flag off)
  // sarebbe solo confuso, non un errore ma inutile rumore in UI.
  let showWalkthroughRestart = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: authProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      showWalkthroughRestart = await resolveFeatureFlag({
        flagName: "TRAMA_ONE_ENABLED",
        userId: user.id,
        role: authProfile?.role ?? "center_admin",
        tenant: "center",
        correlationId: generateCorrelationId(),
      });
    }
  }
  const tutorial = getTutorialDefinition("activity_creation_partner");

  return (
    <div className="animate-fade-in">
      <PageHeader title="Preferenze" backHref="/center/account" />
      <div className="space-y-4 px-5 py-4">
        <ProfilePreferencesSection
          initialLanguage={profile.language}
          initialTheme={profile.theme}
          initialNotifyEmail={profile.notifyEmail}
          initialNotifyPush={profile.notifyPush}
          initialNotifySms={profile.notifySms}
        />
        {showWalkthroughRestart && tutorial && (
          <WalkthroughRestartButton tutorialKey={tutorial.key} tutorialTitle={tutorial.title} />
        )}
      </div>
    </div>
  );
}
