import CenterLeadsView from "@/components/CenterLeadsView";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "I tuoi suggerimenti",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude uno dei
// rimandi legacy segnalati da Fabrizio. Eredita bottom nav/layout NEXTGEN
// venendo da dentro app/nextgen/*.
export default function NextgenCenterLeadsPage() {
  return <CenterLeadsView showBrandIcon />;
}
