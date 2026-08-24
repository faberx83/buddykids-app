import PageHeader from "@/components/PageHeader";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getParentProfile } from "@/lib/data/profile";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/profile/privacy/page.tsx
// per essere riusato anche dal guscio NEXTGEN-native
// (app/nextgen/profile/impostazioni/privacy), stesso pattern già usato per
// "Le mie prenotazioni" (task #524): nessuna nuova query, solo il
// contenitore visivo cambia (showBrandIcon).
//
// BUGFIX preesistente (segnalato da Fabrizio) — raggiungibile sia dal
// profilo LEGACY che da quello NEXTGEN: niente backHref fisso, PageHeader
// ricade su router.back() e torna a dove l'utente era arrivato davvero.
export default async function PrivacyView({ showBrandIcon }: { showBrandIcon?: boolean }) {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Privacy e account" showBrandIcon={showBrandIcon} />
      <div className="px-5 py-4">
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
      </div>
    </div>
  );
}
