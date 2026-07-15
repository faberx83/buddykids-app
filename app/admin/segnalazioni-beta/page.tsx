import { getAllBetaFeedbackForAdmin } from "@/lib/data/beta-feedback";
import SegnalazioniBetaAdminClient from "./SegnalazioniBetaAdminClient";

// SPRINT 5 (NEXTGEN) — coda Admin per le segnalazioni BETA (richiesta di
// Fabrizio: "un report con il numero di segnalazioni per sezione, area,
// sottosezione, se i fix sono in gestione o risolti"). Stesso pattern di
// app/admin/certifications/page.tsx: server component che legge tutte le
// righe (RLS: solo se davvero platform_admin) e passa il risultato al
// client per filtri/aggiornamento stato.
export default async function SegnalazioniBetaAdminPage() {
  const items = await getAllBetaFeedbackForAdmin();
  return <SegnalazioniBetaAdminClient initialItems={items} />;
}
