import PageHeader from "@/components/PageHeader";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getParentProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Privacy e account" (dentro Impostazioni).
export default async function ProfilePrivacyPage() {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — raggiungibile sia dal profilo LEGACY
          che da quello NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna a dove l'utente era arrivato davvero. */}
      <PageHeader title="Privacy e account" />
      <div className="px-5 py-4">
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
      </div>
    </div>
  );
}
