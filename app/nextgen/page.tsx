import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getKidsForUser } from "@/lib/data/kids";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// SPRINT 0 — placeholder che dimostra il plumbing condiviso con LEGACY:
// stessa autenticazione (guard in layout.tsx) e stesso layer dati
// (lib/data/kids.ts, la STESSA funzione usata da Home/Profilo in LEGACY,
// non una copia) senza scrivere nessuna UI definitiva — quella arriva dallo
// Sprint 1 (Dashboard Genitore).
export default async function NextgenHomePage() {
  let fullName: string | null = null;
  let kidsCount = 0;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      fullName = profile?.full_name ?? null;
    }
    kidsCount = (await getKidsForUser()).length;
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">BuddyKids</h1>
        <NextgenBadge />
      </div>
      <div className="rounded-2xl border border-[#E8EBF0] bg-white p-5">
        <p className="text-sm text-ink-2">
          Ciao{fullName ? ` ${fullName.split(" ")[0]}` : ""} — questa è l&apos;area NEXTGEN, in
          costruzione sprint dopo sprint.
        </p>
        <p className="mt-2 text-xs text-ink-3">
          Verifica plumbing: {kidsCount} bambin{kidsCount === 1 ? "o" : "i"} trovat
          {kidsCount === 1 ? "o" : "i"} tramite lo stesso layer dati di LEGACY (nessuna
          duplicazione).
        </p>
      </div>
      <p className="text-xs text-ink-3">
        La Dashboard Genitore vera arriva nello Sprint 1. Questa pagina esiste solo per
        provare che routing, autenticazione e dati condivisi funzionano nel nuovo namespace.
      </p>
    </div>
  );
}
