import PageHeader from "@/components/PageHeader";
import ProfileNotificheSection from "@/components/ProfileNotificheSection";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Notifiche" — stessa struttura del profilo genitore.
export default async function GestoreNotifichePage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notifiche" backHref="/center/account" />
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
