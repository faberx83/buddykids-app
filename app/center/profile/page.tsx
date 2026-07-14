import CenterProfileClient from "./CenterProfileClient";
import { getMyCenter } from "@/lib/data/center-admin";

// Forza il render dinamico per-richiesta: questa pagina dipende dalla
// sessione/cookie dell'utente loggato (getMyCenter -> getCenterContext),
// quindi non deve mai essere servita da una cache condivisa tra utenti o
// stantia tra un aggiornamento di profiles.center_id e l'altro. Difensivo,
// aggiunto durante l'indagine sul bug "Salvato (demo)" persistente segnalato
// da Fabrizio nonostante i dati in Supabase fossero corretti.
export const dynamic = "force-dynamic";

export default async function CenterProfilePage() {
  const { center, dbId } = await getMyCenter();
  return <CenterProfileClient center={center} dbId={dbId} />;
}
