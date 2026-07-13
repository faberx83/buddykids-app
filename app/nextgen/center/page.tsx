import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMyCenter } from "@/lib/data/center-admin";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// SPRINT 0 — placeholder Gestore: riusa getMyCenter() (STESSA funzione di
// app/center/profile/page.tsx in LEGACY) per provare che dati/RLS del centro
// sono raggiungibili anche da qui. La dashboard vera arriva nello Sprint 4.
export default async function NextgenCenterPage() {
  let centerName = "—";
  if (isSupabaseConfigured) {
    const { center } = await getMyCenter();
    centerName = center.name;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">TRAMA Partner</h1>
        <NextgenBadge />
      </div>
      <div className="rounded-2xl border border-[#E8EBF0] bg-white p-5">
        <p className="text-sm text-ink-2">Centro collegato: {centerName}</p>
        <p className="mt-2 text-xs text-ink-3">
          Verifica plumbing: dati letti tramite lo stesso layer di LEGACY (lib/data/center-admin.ts),
          nessuna duplicazione.
        </p>
      </div>
      <p className="mt-4 text-xs text-ink-3">
        La dashboard orientata all&apos;azione arriva nello Sprint 4.
      </p>
    </div>
  );
}
