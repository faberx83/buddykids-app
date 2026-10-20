import PageHeader from "@/components/PageHeader";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Sicurezza", stesso
// pattern di app/nextgen/prenotazioni (task #524): chiude uno dei rimandi
// legacy segnalati da Fabrizio ("nel profilo, sotto impostazioni, ci sono
// ancora rimandi al legacy"). Eredita bottom nav/layout NEXTGEN venendo da
// dentro app/nextgen/*.
//
// 20/10/2026 — IMPOSTAZIONI V2: stessa sezione condivisa con la prop v2
// (SicurezzaView resta per la V1).
export default function NextgenSicurezzaPage() {
  return (
    <div className="flex flex-col pb-10">
      <PageHeader title="Sicurezza" backHref="/nextgen/profile/impostazioni" showBrandIcon />
      <div className="px-5 pt-5">
        <ProfileSecuritySection v2 />
      </div>
    </div>
  );
}
