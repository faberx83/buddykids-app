import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getWalkthroughProgress } from "@/lib/walkthrough/data";
import WalkthroughCard from "./WalkthroughCard";

// TRAMA ONE — Parent. Sprint 0: shell/foundation. Sprint 1: prima
// dimostrazione reale del motore Walkthrough generico (percorso di
// benvenuto), a riprova che lib/walkthrough/* funziona end-to-end prima di
// essere riusato per altri percorsi (onboarding Admin, futuri percorsi
// Partner) nei prossimi sprint.
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
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Parent</h1>
      {walkthrough && <WalkthroughCard progress={walkthrough} />}
    </main>
  );
}
