import PreferitiView from "@/components/PreferitiView";
import { getFavoriteActivitiesForParent } from "@/lib/data/favorites";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Preferiti", stesso
// pattern di app/nextgen/prenotazioni (task #524): chiude uno dei rimandi
// legacy segnalati da Fabrizio ("nel profilo ci sono ancora rimandi al
// legacy"). Nessuna nuova query: riusa PreferitiView + i dati di sempre,
// eredita bottom nav/layout NEXTGEN venendo da dentro app/nextgen/*.
export default async function NextgenPreferitiPage() {
  const favorites = await getFavoriteActivitiesForParent();
  return <PreferitiView favorites={favorites} showBrandIcon />;
}
