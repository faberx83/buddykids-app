import { getAllBetaFeedbackForAdmin } from "@/lib/data/beta-feedback";
import SegnalazioniBetaAdminClient from "./SegnalazioniBetaAdminClient";

// SPRINT 5 (NEXTGEN) — coda Admin per le segnalazioni BETA (richiesta di
// Fabrizio: "un report con il numero di segnalazioni per sezione, area,
// sottosezione, se i fix sono in gestione o risolti"). Stesso pattern di
// app/admin/certifications/page.tsx: server component che legge tutte le
// righe (RLS: solo se davvero platform_admin) e passa il risultato al
// client per filtri/aggiornamento stato.
// ADMIN OPERATIVO (12/11/2026): filtri da URL (?stato=nuovo&area=…), così la
// card "Segnalazioni BETA nuove" di Oggi apre l'elenco già filtrato.
export default async function SegnalazioniBetaAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const items = await getAllBetaFeedbackForAdmin();
  return (
    <SegnalazioniBetaAdminClient
      initialItems={items}
      initialStatus={typeof sp.stato === "string" ? sp.stato : "tutti"}
      initialArea={typeof sp.area === "string" ? sp.area : "tutte"}
    />
  );
}
