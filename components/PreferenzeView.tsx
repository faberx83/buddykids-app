import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import { getParentProfile } from "@/lib/data/profile";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/profile/preferenze/page.tsx
// per essere riusato anche dal guscio NEXTGEN-native
// (app/nextgen/profile/impostazioni/preferenze), stesso pattern già usato
// per "Le mie prenotazioni" (task #524): nessuna nuova query, solo il
// contenitore visivo cambia (showBrandIcon).
export default async function PreferenzeView({ showBrandIcon }: { showBrandIcon?: boolean }) {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Preferenze" showBrandIcon={showBrandIcon} />
      <div className="px-5 py-4">
        <ProfilePreferencesSection
          initialLanguage={profile.language}
          initialTheme={profile.theme}
          initialNotifyEmail={profile.notifyEmail}
          initialNotifyPush={profile.notifyPush}
          initialNotifySms={profile.notifySms}
        />
      </div>
    </div>
  );
}
