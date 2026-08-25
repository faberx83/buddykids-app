import Link from "next/link";
import NewCenterForm from "@/components/admin/NewCenterForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listAllCentersForAdmin } from "@/lib/onboarding/data";
import { getOnboardingStatusLabel, getOnboardingStatusBadgeClassName } from "@/lib/onboarding/status-copy";

// PRE-MICRO-PILOT GATE (R-01, task #557, 25/08/2026) — questa pagina era
// SEMPRE lib/mock-data.ts (vedi commento rimosso sotto), anche dopo aver
// creato un centro reale con "Nuovo centro" qui sopra: un Admin non aveva
// modo di trovare un centro pilota reale senza query SQL dirette o
// conoscere l'ID a memoria. Resa reale su richiesta esplicita di Fabrizio
// ("riusa la route più coerente esistente... NON serve costruire una nuova
// dashboard analytics") — stessa route, stesso URL, nessuna nuova
// dashboard: solo dati veri al posto del mock.
export default async function AdminCentersPage() {
  const centers = await listAllCentersForAdmin();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
          <h1 className="text-xl font-bold text-white">Centri</h1>
          <p className="text-sm text-navy-text2">
            Tutti i centri registrati su Supabase ({centers.length})
          </p>
        </div>
        {isSupabaseConfigured && <NewCenterForm />}
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
          Supabase non configurato: nessun centro reale da mostrare in questo ambiente.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Centro</th>
              <th className="px-4 py-3 font-medium">Comune</th>
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Stato attivazione</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => (
              <tr key={c.centerId} className="border-b border-[#F0F2F5] last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{c.name}</span>
                    {/* Classificazione euristica (nome/slug con pattern
                        "test"/"prova"/"[TEST]"), non un giudizio definitivo —
                        l'Admin può sempre aprire il dettaglio e verificare. */}
                    {c.looksLikeTest && (
                      <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-3">
                        Test/demo
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">{c.city ?? "—"}</td>
                <td className="px-4 py-3 text-ink-2">{c.activityCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getOnboardingStatusBadgeClassName(c.onboardingStatus)}`}
                  >
                    {getOnboardingStatusLabel(c.onboardingStatus, "admin")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/centers/${c.centerId}`} className="text-xs font-semibold text-sky">
                    Dettaglio →
                  </Link>
                </td>
              </tr>
            ))}
            {centers.length === 0 && isSupabaseConfigured && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessun centro trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
