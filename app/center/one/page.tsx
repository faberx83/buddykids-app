import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getWalkthroughProgress } from "@/lib/walkthrough/data";
import WalkthroughCard from "@/app/one/WalkthroughCard";

// TRAMA ONE — Partner. Sprint 0: shell/foundation. Sprint 1: prima
// funzionalità di business reale (onboarding), collegata da qui. Sprint 2:
// aggiunto il percorso Walkthrough "activity_creation_partner" (registry.ts),
// stesso motore generico già dimostrato in app/one/page.tsx per il Parent —
// nessuna modifica al motore, solo riuso del componente WalkthroughCard e
// della definizione di percorso.
//
// CONTROLLED BETA EXPERIENCE GATE (§4-6, restyle prima del wiring/DEC-58) —
// stessa correzione di app/one/page.tsx: rimosso l'`<h1>` di sistema, il
// `style={{padding:24}}` inline e il colore hardcoded `#2E86DE` per il link
// (non un token del design system — violazione diretta del vincolo "non
// introdurre colori locali se esiste un token"). Nessun wrapper `<main>`
// aggiuntivo: `DashboardLayout` (app/center/layout.tsx) applica già
// `p-5 md:p-8` responsive al suo `<main>`, stesso pattern di
// `RichiesteClient.tsx`/le altre pagine Partner mature (h1 Tailwind, non
// inline). Questa route resta `INTERNAL_ONLY` (§6.2 del Route Release
// Matrix): nessuna voce di menu viene aggiunta qui.
export default async function OneCenterPage() {
  let userId: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const walkthrough = await getWalkthroughProgress(userId, "activity_creation_partner");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">TRAMA ONE — Partner</h1>
        <p className="text-sm text-ink-2">
          <Link href="/center/one/onboarding" className="font-semibold text-trama-violet hover:underline">
            Vai all&apos;onboarding del centro →
          </Link>
        </p>
      </div>

      {walkthrough ? (
        <WalkthroughCard progress={walkthrough} />
      ) : (
        <div className="max-w-[480px] rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
          <i className="ti ti-route mb-2 text-2xl text-ink-3" />
          <p className="text-xs text-ink-2">Nessun percorso guidato disponibile al momento.</p>
        </div>
      )}
    </div>
  );
}
