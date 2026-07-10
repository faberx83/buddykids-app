import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Preferenze" — stessa struttura del profilo genitore,
// include anche le notifiche (unite qui su richiesta di Fabrizio).
export default async function GestorePreferenzePage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Preferenze" backHref="/center/account" />
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
