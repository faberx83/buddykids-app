import SicurezzaView from "@/components/SicurezzaView";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Sicurezza", stesso
// pattern di app/nextgen/prenotazioni (task #524): chiude uno dei rimandi
// legacy segnalati da Fabrizio ("nel profilo, sotto impostazioni, ci sono
// ancora rimandi al legacy"). Eredita bottom nav/layout NEXTGEN venendo da
// dentro app/nextgen/*.
export default function NextgenSicurezzaPage() {
  return <SicurezzaView showBrandIcon />;
}
