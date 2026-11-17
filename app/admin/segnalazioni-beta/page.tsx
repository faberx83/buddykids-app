import { getAllBetaFeedbackForAdmin } from "@/lib/data/beta-feedback";
import { getTestAccountIds } from "@/lib/data/admin-ops";
import { withoutTestAccounts } from "@/lib/admin-ops/test-accounts";

// 17/11/2026: le segnalazioni degli "Account di prova" (Beta Famiglie) sono
// fuori dai conteggi e dall'elenco; si vedono con ?demo=1.
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
  const [all, testAccounts] = await Promise.all([getAllBetaFeedbackForAdmin(), getTestAccountIds()]);
  const showTest = sp.demo === "1";
  const items = withoutTestAccounts(all, (f) => f.parentId, testAccounts, showTest);
  return (
    <SegnalazioniBetaAdminClient
      initialItems={items}
      showTest={showTest}
      hiddenTest={all.length - items.length}
      testInList={showTest ? all.filter((f) => f.parentId && testAccounts.has(f.parentId)).length : 0}
      initialStatus={typeof sp.stato === "string" ? sp.stato : "tutti"}
      initialArea={typeof sp.area === "string" ? sp.area : "tutte"}
    />
  );
}
