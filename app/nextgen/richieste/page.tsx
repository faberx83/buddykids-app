import RichiesteView from "@/components/RichiesteView";
import { getInquiriesForParent } from "@/lib/data/inquiries";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Le mie richieste",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude uno dei
// rimandi legacy segnalati da Fabrizio. Nessuna nuova query: riusa
// RichiesteView + i dati di sempre, eredita bottom nav/layout NEXTGEN
// venendo da dentro app/nextgen/*.
export default async function NextgenRichiestePage() {
  const inquiries = await getInquiriesForParent();
  return <RichiesteView inquiries={inquiries} showBrandIcon />;
}
