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
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Partner</h1>
      <p>
        <Link href="/center/one/onboarding" style={{ color: "#2E86DE", fontWeight: 600 }}>
          Vai all&apos;onboarding del centro →
        </Link>
      </p>
      {walkthrough && <WalkthroughCard progress={walkthrough} />}
    </main>
  );
}
