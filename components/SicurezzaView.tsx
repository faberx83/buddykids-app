import PageHeader from "@/components/PageHeader";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/profile/sicurezza/page.tsx
// per essere riusato anche dal guscio NEXTGEN-native
// (app/nextgen/profile/impostazioni/sicurezza), stesso pattern già usato per
// "Le mie prenotazioni" (task #524): nessun comportamento cambiato, solo il
// contenitore visivo (showBrandIcon).
export default function SicurezzaView({ showBrandIcon }: { showBrandIcon?: boolean }) {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Sicurezza" showBrandIcon={showBrandIcon} />
      <div className="px-5 py-4">
        <ProfileSecuritySection />
      </div>
    </div>
  );
}
