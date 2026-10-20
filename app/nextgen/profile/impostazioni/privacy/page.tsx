import PageHeader from "@/components/PageHeader";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getParentProfile } from "@/lib/data/profile";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Privacy e account",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude uno dei
// rimandi legacy segnalati da Fabrizio ("nel profilo, sotto impostazioni,
// ci sono ancora rimandi al legacy"). Eredita bottom nav/layout NEXTGEN
// venendo da dentro app/nextgen/*.
//
// 20/10/2026 — IMPOSTAZIONI V2: stessa sezione condivisa con la prop v2,
// documenti compresi (PrivacyView resta per la V1).
export default async function NextgenPrivacyPage() {
  const profile = await getParentProfile();
  return (
    <div className="flex flex-col pb-10">
      <PageHeader title="Privacy e account" backHref="/nextgen/profile/impostazioni" showBrandIcon />
      <div className="px-5 pt-5">
        <ProfilePrivacySection v2 initialMarketingConsent={profile.marketingConsent} initialAccountStatus={profile.accountStatus} />
      </div>
    </div>
  );
}
