import PageHeader from "@/components/PageHeader";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Privacy e account" — stessa struttura del profilo
// genitore.
export default async function GestorePrivacyPage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Privacy e account" backHref="/center/account" />
      <div className="px-5 py-4">
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
      </div>
    </div>
  );
}
