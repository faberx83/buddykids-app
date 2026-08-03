import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getWalkthroughProgress } from "@/lib/walkthrough/data";
import WalkthroughCard from "./WalkthroughCard";
import PageHeader from "@/components/PageHeader";

// TRAMA ONE — Parent. Sprint 0: shell/foundation. Sprint 1: prima
// dimostrazione reale del motore Walkthrough generico (percorso di
// benvenuto), a riprova che lib/walkthrough/* funziona end-to-end prima di
// essere riusato per altri percorsi (onboarding Admin, futuri percorsi
// Partner) nei prossimi sprint.
//
// CONTROLLED BETA EXPERIENCE GATE (§4-6, restyle prima del wiring/DEC-58) —
// questa route resta INTERNAL_ONLY (nessuna voce di menu, vedi
// TRAMA_ONE_ROUTE_RELEASE_MATRIX.md §6.1): non riceve qui una destinazione di
// navigazione, ma va comunque restyle-ata perché raggiungibile da un utente
// reale della coorte Controlled Beta (URL diretto). Rimosso l'`<h1>` di
// sistema e il `style={{padding:24}}` inline: stesso linguaggio visivo di
// `/nextgen/profile/segnalazioni` (PageHeader con icona brand + contenitore a
// colonna), non un widget isolato. Aggiunto uno stato vuoto esplicito
// (prima: nessun contenuto se `walkthrough` è `null`, schermata bianca senza
// spiegazione). Titolo lasciato invariato ("TRAMA ONE — Parent", non solo
// "TRAMA ONE"): tests/one/smoke.spec.ts (TC-N306) verifica
// `page.getByText("TRAMA ONE — Parent")` — nessuna modifica al test
// necessaria, il restyle cambia solo la presentazione, non il contenuto
// testuale verificato.
export default async function OneParentPage() {
  let userId: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const walkthrough = await getWalkthroughProgress(userId, "welcome_parent");

  return (
    <div className="flex min-h-screen flex-col bg-trama-page">
      <PageHeader title="TRAMA ONE — Parent" backHref="/nextgen" showBrandIcon />
      <div className="flex flex-col gap-3 px-5 py-4">
        {walkthrough ? (
          <WalkthroughCard progress={walkthrough} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
            <i className="ti ti-route mb-2 text-2xl text-ink-3" />
            <p className="text-xs text-ink-2">Nessun percorso guidato disponibile al momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
