import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import { getParentProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Preferenze" (dentro Impostazioni) — include anche
// le notifiche (unite qui su richiesta di Fabrizio, vedi
// ProfileSettingsSection.tsx e ProfilePreferencesSection.tsx).
export default async function ProfilePreferenzePage() {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — raggiungibile sia dal profilo LEGACY
          che da quello NEXTGEN (ProfileSettingsSection, basePath="/profile"
          in entrambi): niente backHref fisso, PageHeader ricade su
          router.back() e torna a dove l'utente era arrivato davvero. */}
      <PageHeader title="Preferenze" />
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
