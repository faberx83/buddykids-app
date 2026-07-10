import PageHeader from "@/components/PageHeader";
import ProfileNotificheSection from "@/components/ProfileNotificheSection";
import { getParentProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Notifiche" (dentro Impostazioni).
export default async function ProfileNotifichePage() {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notifiche" backHref="/profile" />
      <div className="px-5 py-4">
        <ProfileNotificheSection
          initialNotifyEmail={profile.notifyEmail}
          initialNotifyPush={profile.notifyPush}
          initialNotifySms={profile.notifySms}
        />
      </div>
    </div>
  );
}
