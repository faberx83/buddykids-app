import PrivacyView from "@/components/PrivacyView";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Privacy e account",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude uno dei
// rimandi legacy segnalati da Fabrizio ("nel profilo, sotto impostazioni,
// ci sono ancora rimandi al legacy"). Eredita bottom nav/layout NEXTGEN
// venendo da dentro app/nextgen/*.
export default function NextgenPrivacyPage() {
  return <PrivacyView showBrandIcon />;
}
