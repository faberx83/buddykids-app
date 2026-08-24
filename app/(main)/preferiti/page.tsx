import PreferitiView from "@/components/PreferitiView";
import { getFavoriteActivitiesForParent } from "@/lib/data/favorites";

// "Preferiti" (richiesta da Fabrizio per la v1): prima il cuore nella scheda
// attività non persisteva mai (vedi FUNCTIONAL-TC-026) — ora salva davvero
// (supabase/schema.sql#favorites) e questa pagina elenca i salvati.
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/PreferitiView.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/preferiti),
// stesso pattern di "Le mie prenotazioni" (task #524): nessun comportamento
// cambiato qui, solo spostato in un componente condiviso.
export default async function PreferitiPage() {
  const favorites = await getFavoriteActivitiesForParent();
  return <PreferitiView favorites={favorites} />;
}
